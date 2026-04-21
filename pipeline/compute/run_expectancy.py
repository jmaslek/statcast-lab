"""RE24 matrix and RE-derived linear weights.

Both are computed from first principles using the base-out state at each PA
and the actual runs scored in the remainder of the half-inning.
"""

import polars as pl
from loguru import logger

from pipeline.compute._common import (
    HALF_INNING_COLS,
    Client,
    base_out_state_expr,
    delete_season,
    load_re_matrix,
    re_map_expr,
)

EVENT_CATEGORIES: dict[str, str] = {
    "single": "1B",
    "double": "2B",
    "triple": "3B",
    "home_run": "HR",
    "walk": "BB",
    "hit_by_pitch": "HBP",
}


def encode_base_out_state(outs: int, on_1b: bool, on_2b: bool, on_3b: bool) -> int:
    """Pack (runners, outs) into a 0-23 integer; outs in the low trit."""
    base = int(on_3b) * 4 + int(on_2b) * 2 + int(on_1b)
    return base * 3 + outs


def decode_base_out_state(state: int) -> tuple[int, str]:
    """Inverse of encode_base_out_state. Returns (outs, "---"-style runner string)."""
    b = state // 3
    runners = (
        ("1" if b & 1 else "-")
        + ("2" if b & 2 else "-")
        + ("3" if b & 4 else "-")
    )
    return state % 3, runners


def categorize_event(event: str | None) -> str | None:
    """Statcast event -> wOBA bucket (1B/2B/3B/HR/BB/HBP/OUT). None passes through."""
    if event is None:
        return None
    return EVENT_CATEGORIES.get(event, "OUT")


_PA_QUERY = """
SELECT
    game_pk,
    inning,
    inning_topbot,
    at_bat_number,
    batter,
    outs_when_up,
    on_1b IS NOT NULL AS r1,
    on_2b IS NOT NULL AS r2,
    on_3b IS NOT NULL AS r3,
    events,
    bat_score,
    post_bat_score
FROM pitches
WHERE game_year = {season:UInt16}
  AND events IS NOT NULL
  AND events != 'truncated_pa'
  AND game_type = 'R'
  AND bat_score IS NOT NULL
  AND post_bat_score IS NOT NULL
ORDER BY game_pk, at_bat_number
"""


_PA_SCHEMA = {
    "game_pk": pl.UInt32,
    "inning": pl.UInt8,
    "inning_topbot": pl.String,
    "at_bat_number": pl.UInt16,
    "batter": pl.UInt32,
    "outs_when_up": pl.UInt8,
    "r1": pl.Boolean,
    "r2": pl.Boolean,
    "r3": pl.Boolean,
    "events": pl.String,
    "bat_score": pl.Int16,
    "post_bat_score": pl.Int16,
}


def _fetch_pa_data(client: Client, season: int) -> pl.DataFrame:
    result = client.query(_PA_QUERY, parameters={"season": season})
    if not result.result_rows:
        return pl.DataFrame(schema=_PA_SCHEMA)
    return pl.DataFrame(
        result.result_rows, schema=list(_PA_SCHEMA), orient="row",
    )


def compute_re_matrix(client: Client, season: int) -> dict[int, float]:
    """Build the 24-state RE matrix for a season and persist to season_re_matrix."""
    logger.info("Computing RE matrix for {}", season)
    df = _fetch_pa_data(client, season)
    if df.is_empty():
        logger.warning("No PA data for {}", season)
        return {}

    df = df.with_columns(base_out_state_expr().alias("base_out_state"))

    df = df.with_columns([
        pl.col("bat_score").first().over(HALF_INNING_COLS).alias("inning_start"),
        pl.col("post_bat_score").last().over(HALF_INNING_COLS).alias("inning_end"),
    ])
    df = df.with_columns(
        (
            pl.col("inning_end") - pl.col("bat_score")
        ).alias("runs_remaining")
    )

    re_df = (
        df.group_by("base_out_state")
        .agg([
            pl.col("runs_remaining").mean().alias("expected_runs"),
            pl.col("runs_remaining").count().alias("occurrences"),
        ])
        .sort("base_out_state")
    )

    re_matrix: dict[int, float] = {}
    rows = []
    for row in re_df.iter_rows(named=True):
        state = row["base_out_state"]
        re_matrix[state] = row["expected_runs"]
        outs, runners = decode_base_out_state(state)
        rows.append([
            season, state, outs, runners,
            row["expected_runs"], row["occurrences"],
        ])

    if rows:
        delete_season(client, "season_re_matrix", season)
        client.insert(
            "season_re_matrix",
            rows,
            column_names=[
                "season", "base_out_state", "outs", "runners_on",
                "expected_runs", "occurrences",
            ],
        )
        logger.info("Wrote {} RE matrix entries for {}", len(rows), season)

    return re_matrix


def _apply_re_mapping(
    df: pl.DataFrame,
    re_matrix: dict[int, float],
) -> pl.DataFrame:
    """Attach re_pre, re_post, runs_scored, and run_value to each PA."""
    df = df.with_columns([
        pl.col("base_out_state")
            .shift(-1).over(HALF_INNING_COLS)
            .alias("next_base_out_state"),
        pl.col("game_pk")
            .shift(-1).over(HALF_INNING_COLS)
            .alias("next_game_pk"),
    ])
    df = df.with_columns(pl.col("next_game_pk").is_null().alias("is_terminal"))

    df = df.with_columns(re_map_expr(re_matrix, "base_out_state").alias("re_pre"))
    df = df.with_columns(
        pl.when(pl.col("is_terminal"))
        .then(pl.lit(0.0))
        .otherwise(re_map_expr(re_matrix, "next_base_out_state"))
        .alias("re_post")
    )
    return df.with_columns([
        (pl.col("post_bat_score") - pl.col("bat_score")).alias("runs_scored"),
    ]).with_columns(
        (pl.col("re_post") - pl.col("re_pre") + pl.col("runs_scored")).alias("run_value")
    )


EVENT_KEYS = ["BB", "HBP", "1B", "2B", "3B", "HR"]


def compute_linear_weights(
    client: Client,
    season: int,
    re_matrix: dict[int, float] | None = None,
) -> dict[str, float]:
    """Derive wOBA weights from RE24. Scales to match league OBP on published wOBAs."""
    logger.info("Computing linear weights for {}", season)

    if re_matrix is None:
        re_matrix = load_re_matrix(client, season)
    if not re_matrix:
        raise ValueError(
            f"No RE matrix for {season}. Run 'compute re-matrix' first."
        )

    df = _fetch_pa_data(client, season)
    if df.is_empty():
        raise ValueError(f"No PA data for {season}")

    df = df.with_columns(base_out_state_expr().alias("base_out_state"))
    df = _apply_re_mapping(df, re_matrix)
    df = df.with_columns(
        pl.col("events")
        .replace_strict(EVENT_CATEGORIES, default="OUT")
        .alias("event_cat")
    )

    raw = {
        r["event_cat"]: r["avg_run_value"]
        for r in df.group_by("event_cat")
        .agg(pl.col("run_value").mean().alias("avg_run_value"))
        .iter_rows(named=True)
    }
    run_out = raw.get("OUT", 0.0)
    above_out = {k: raw.get(k, 0.0) - run_out for k in EVENT_KEYS}

    lg = client.query(
        """
        SELECT
            sum(hits) AS hits,
            sum(walks) AS walks,
            sum(hbp) AS hbp,
            sum(ab) AS ab,
            sum(sac_flies) AS sf,
            sum(singles) AS singles,
            sum(doubles) AS doubles,
            sum(triples) AS triples,
            sum(home_runs) AS hr
        FROM player_season_hitting FINAL
        WHERE season = {season:UInt16}
        """,
        parameters={"season": season},
    ).result_rows[0]
    hits, walks, hbp, ab, sf, singles, doubles, triples, hr = lg

    obp_denom = ab + walks + hbp + sf
    lg_obp = (hits + walks + hbp) / obp_denom if obp_denom > 0 else 0.0

    def _weighted(w: dict[str, float]) -> float:
        if obp_denom <= 0:
            return 0.0
        return (
            w["BB"] * walks + w["HBP"] * hbp
            + w["1B"] * singles + w["2B"] * doubles
            + w["3B"] * triples + w["HR"] * hr
        ) / obp_denom

    lg_woba_unscaled = _weighted(above_out)
    woba_scale = lg_obp / lg_woba_unscaled if lg_woba_unscaled else 1.0
    final = {k: above_out[k] * woba_scale for k in EVENT_KEYS}
    lg_woba = _weighted(final)

    total_pa = client.query(
        "SELECT sum(pa) FROM player_season_hitting FINAL "
        "WHERE season = {season:UInt16}",
        parameters={"season": season},
    ).result_rows[0][0]
    total_runs = client.query(
        """
        SELECT sum(post_bat_score - bat_score)
        FROM pitches
        WHERE game_year = {season:UInt16}
          AND events IS NOT NULL AND events != 'truncated_pa'
          AND game_type = 'R'
          AND bat_score IS NOT NULL AND post_bat_score IS NOT NULL
        """,
        parameters={"season": season},
    ).result_rows[0][0]
    lg_r_pa = total_runs / total_pa if total_pa else 0.0

    out = {f"w{k}": final[k] for k in EVENT_KEYS}
    out.update(run_out=run_out, lg_woba=lg_woba, woba_scale=woba_scale, lg_r_pa=lg_r_pa)

    client.command(
        "ALTER TABLE season_linear_weights DELETE "
        "WHERE season = {season:UInt16} AND source = 'custom'",
        parameters={"season": season},
    )
    insert_cols = [
        "wBB", "wHBP", "w1B", "w2B", "w3B", "wHR",
        "run_out", "lg_woba", "woba_scale", "lg_r_pa",
    ]
    client.insert(
        "season_linear_weights",
        [[season, "custom"] + [out[k] for k in insert_cols]],
        column_names=["season", "source", *insert_cols],
    )
    logger.info("Wrote custom linear weights for {}", season)
    return out


def compute_player_re24(
    client: Client,
    season: int,
    re_matrix: dict[int, float] | None = None,
    min_pa: int = 50,
) -> int:
    logger.info("Player RE24 for {} (min_pa={})", season, min_pa)

    if re_matrix is None:
        re_matrix = load_re_matrix(client, season)
    if not re_matrix:
        raise ValueError(
            f"No RE matrix for {season}. Run 'compute re-matrix' first."
        )

    df = _fetch_pa_data(client, season)
    if df.is_empty():
        logger.warning("No PA data for {}", season)
        return 0

    df = df.with_columns(base_out_state_expr().alias("base_out_state"))
    df = _apply_re_mapping(df, re_matrix)

    player_df = (
        df.group_by("batter")
        .agg([
            pl.col("run_value").count().alias("pa"),
            pl.col("run_value").sum().alias("re24"),
        ])
        .filter(pl.col("pa") >= min_pa)
        .with_columns((pl.col("re24") / pl.col("pa")).alias("re24_per_pa"))
        .sort("re24", descending=True)
    )

    rows = [
        [r["batter"], season, r["pa"], r["re24"], r["re24_per_pa"]]
        for r in player_df.iter_rows(named=True)
    ]
    if rows:
        delete_season(client, "player_season_re24", season)
        client.insert(
            "player_season_re24",
            rows,
            column_names=["player_id", "season", "pa", "re24", "re24_per_pa"],
        )
        logger.info("Wrote RE24 for {} players in {}", len(rows), season)
    return len(rows)
