"""WAR computations: batting (wOBA-based) and pitching (RA9 + RE24)."""

import polars as pl
from loguru import logger

from pipeline.compute._common import (
    HALF_INNING_COLS,
    Client,
    base_out_state_expr,
    delete_season,
    load_re_matrix,
    outs_recorded_sql,
    re_map_expr,
)

# Runs per win (roughly constant across eras)
RUNS_PER_WIN = 10.0

# Replacement level runs per PA (about 20 runs below average over 600 PA)
REPLACEMENT_RUNS_PER_PA = -0.0333  # ~-20 / 600

BATTING_WAR_DDL = """
CREATE TABLE IF NOT EXISTS player_batting_war (
    player_id UInt32,
    season UInt16,
    pa UInt64,
    woba Float64,
    wrc_plus Float64,
    batting_runs Float64,
    replacement_runs Float64,
    war Float64
) ENGINE = ReplacingMergeTree()
ORDER BY (player_id, season)
"""


def compute_batting_war(
    client: Client,
    season: int,
    min_pa: int = 50,
) -> int:
    """Compute batting WAR for all qualifying hitters in a season.

    Formula:
        batting_runs = ((wOBA - lg_wOBA) / woba_scale) * PA
        replacement_runs = REPLACEMENT_RUNS_PER_PA * PA  (negative = below avg)
        WAR = (batting_runs - replacement_runs) / RUNS_PER_WIN

    Returns number of players computed.
    """
    client.command(BATTING_WAR_DDL)

    result = client.query(
        """
        SELECT player_id, pa, woba, woba_scale, lg_woba, wrc_plus
        FROM player_woba FINAL
        WHERE season = {season:UInt16}
          AND pa >= {min_pa:UInt64}
        """,
        parameters={"season": season, "min_pa": min_pa},
    )

    if not result.result_rows:
        logger.warning("No wOBA data for %d — run 'compute woba' first", season)
        return 0

    rows = []
    for pid, pa, woba, woba_scale, lg_woba, wrc_plus in result.result_rows:
        if woba_scale == 0:
            continue

        batting_runs = ((woba - lg_woba) / woba_scale) * pa
        replacement_runs = REPLACEMENT_RUNS_PER_PA * pa
        war = (batting_runs - replacement_runs) / RUNS_PER_WIN

        rows.append(
            [
                pid,
                season,
                pa,
                round(woba, 3),
                round(wrc_plus, 1),
                round(batting_runs, 1),
                round(replacement_runs, 1),
                round(war, 1),
            ]
        )

    if rows:
        delete_season(client, "player_batting_war", season)
        client.insert(
            "player_batting_war",
            rows,
            column_names=[
                "player_id",
                "season",
                "pa",
                "woba",
                "wrc_plus",
                "batting_runs",
                "replacement_runs",
                "war",
            ],
        )

    logger.info("Computed batting WAR for %d players in %d", len(rows), season)
    return len(rows)


# --- Pitching WAR ---

# Replacement-level RA/9 — roughly a freely available pitcher
REPLACEMENT_RA9 = 5.5

PITCHING_WAR_DDL = """
CREATE TABLE IF NOT EXISTS player_pitching_war (
    player_id UInt32,
    season UInt16,
    ip Float64,
    ra9 Float64,
    lg_ra9 Float64,
    ra9_war Float64,
    re24 Float64,
    re24_war Float64
) ENGINE = ReplacingMergeTree()
ORDER BY (player_id, season)
"""


def _compute_pitcher_ra9(
    client: Client,
    season: int,
    min_ip: float,
) -> tuple[float, list]:
    """Compute RA/9 for each pitcher. Returns (lg_ra9, rows)."""
    outs_expr = outs_recorded_sql()
    min_outs = int(min_ip * 3)

    # League RA/9
    lg_result = client.query(
        f"""
        SELECT
            {outs_expr} AS outs_recorded,
            sum(post_bat_score - bat_score) AS runs
        FROM pitches
        WHERE game_year = {{season:UInt16}}
          AND events IS NOT NULL
  AND events != 'truncated_pa'
          AND game_type = 'R'
          AND bat_score IS NOT NULL
          AND post_bat_score IS NOT NULL
        """,
        parameters={"season": season},
    )
    lg_outs, lg_runs = lg_result.result_rows[0]
    lg_ip = lg_outs / 3.0
    lg_ra9 = (lg_runs / lg_ip * 9.0) if lg_ip > 0 else 0.0

    # Per-pitcher
    result = client.query(
        f"""
        SELECT
            pitcher,
            {outs_expr} AS outs_recorded,
            sum(post_bat_score - bat_score) AS runs
        FROM pitches
        WHERE game_year = {{season:UInt16}}
          AND events IS NOT NULL
  AND events != 'truncated_pa'
          AND game_type = 'R'
          AND bat_score IS NOT NULL
          AND post_bat_score IS NOT NULL
        GROUP BY pitcher
        HAVING outs_recorded >= {{min_outs:UInt32}}
        """,
        parameters={"season": season, "min_outs": min_outs},
    )

    rows = []
    for pitcher, outs, runs in result.result_rows:
        ip = outs / 3.0
        ra9 = (runs / ip * 9.0) if ip > 0 else 0.0
        ra9_war = (REPLACEMENT_RA9 - ra9) / 9.0 * ip / RUNS_PER_WIN
        rows.append((pitcher, ip, ra9, ra9_war))

    return lg_ra9, rows


def _compute_pitcher_re24(
    client: Client,
    season: int,
    min_outs: int,
) -> dict[int, float]:
    """Compute pitcher RE24 totals. Returns {pitcher_id: re24}."""
    re_matrix = load_re_matrix(client, season)
    if not re_matrix:
        logger.warning("No RE matrix for %d — run 'compute re-matrix' first", season)
        return {}

    result = client.query(
        """
        SELECT
            game_pk, inning, inning_topbot, at_bat_number,
            pitcher, outs_when_up,
            on_1b IS NOT NULL AS r1, on_2b IS NOT NULL AS r2, on_3b IS NOT NULL AS r3,
            events, bat_score, post_bat_score
        FROM pitches
        WHERE game_year = {season:UInt16}
          AND events IS NOT NULL
  AND events != 'truncated_pa'
          AND game_type = 'R'
          AND bat_score IS NOT NULL
          AND post_bat_score IS NOT NULL
        ORDER BY game_pk, at_bat_number
        """,
        parameters={"season": season},
    )

    if not result.result_rows:
        return {}

    columns = [
        "game_pk",
        "inning",
        "inning_topbot",
        "at_bat_number",
        "pitcher",
        "outs_when_up",
        "r1",
        "r2",
        "r3",
        "events",
        "bat_score",
        "post_bat_score",
    ]
    df = pl.DataFrame(result.result_rows, schema=columns, orient="row")

    df = df.with_columns(base_out_state_expr().alias("base_out_state"))

    # Next state within half-inning
    df = df.with_columns(
        [
            pl.col("base_out_state")
            .shift(-1)
            .over(HALF_INNING_COLS)
            .alias("next_state"),
            pl.col("game_pk").shift(-1).over(HALF_INNING_COLS).alias("next_gp"),
        ]
    )
    df = df.with_columns(pl.col("next_gp").is_null().alias("is_terminal"))

    # Map RE values
    df = df.with_columns(re_map_expr(re_matrix, "base_out_state").alias("re_pre"))
    df = df.with_columns(
        pl.when(pl.col("is_terminal"))
        .then(pl.lit(0.0))
        .otherwise(re_map_expr(re_matrix, "next_state"))
        .alias("re_post")
    )

    # Run value (from pitcher's perspective: negative is good)
    df = df.with_columns(
        (pl.col("post_bat_score") - pl.col("bat_score")).alias("runs_scored")
    )
    df = df.with_columns(
        (pl.col("re_post") - pl.col("re_pre") + pl.col("runs_scored")).alias(
            "run_value"
        )
    )

    # Pitcher RE24 = negative of batter run_value (pitcher benefits when run value is low)
    pitcher_df = (
        df.group_by("pitcher")
        .agg(
            [
                pl.col("run_value").sum().alias("re24_raw"),
                pl.col("run_value").count().alias("bf"),
            ]
        )
        .filter(pl.col("bf") >= min_outs)  # rough filter
    )

    return {
        row["pitcher"]: -row["re24_raw"] for row in pitcher_df.iter_rows(named=True)
    }


def compute_pitching_war(
    client: Client,
    season: int,
    min_ip: float = 10.0,
) -> int:
    """Compute pitching WAR using both RA9 and RE24 methods.

    Returns number of pitchers computed.
    """
    client.command(PITCHING_WAR_DDL)

    min_outs = int(min_ip * 3)

    lg_ra9, ra9_rows = _compute_pitcher_ra9(client, season, min_ip)
    re24_data = _compute_pitcher_re24(client, season, min_outs)

    if not ra9_rows:
        logger.warning("No qualifying pitchers for %d", season)
        return 0

    rows = []
    for pitcher, ip, ra9, ra9_war in ra9_rows:
        re24 = re24_data.get(pitcher, 0.0)
        re24_war = re24 / RUNS_PER_WIN

        rows.append(
            [
                pitcher,
                season,
                round(ip, 1),
                round(ra9, 2),
                round(lg_ra9, 2),
                round(ra9_war, 1),
                round(re24, 1),
                round(re24_war, 1),
            ]
        )

    if rows:
        delete_season(client, "player_pitching_war", season)
        client.insert(
            "player_pitching_war",
            rows,
            column_names=[
                "player_id",
                "season",
                "ip",
                "ra9",
                "lg_ra9",
                "ra9_war",
                "re24",
                "re24_war",
            ],
        )

    logger.info("Computed pitching WAR for %d pitchers in %d", len(rows), season)
    return len(rows)
