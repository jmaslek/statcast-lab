"""Run expectancy matrix and custom linear weights computation.

Computes RE24 from first principles using base-out state and actual scoring
within each half-inning, then derives custom linear weights for wOBA.
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

# Map Statcast event names to our event categories
EVENT_CATEGORIES: dict[str, str] = {
    "single": "1B",
    "double": "2B",
    "triple": "3B",
    "home_run": "HR",
    "walk": "BB",
    "hit_by_pitch": "HBP",
}


def categorize_event(event: str | None) -> str | None:
    """Map a Statcast event string to a category (1B, 2B, 3B, HR, BB, HBP, OUT)."""
    if event is None:
        return None
    if event in EVENT_CATEGORIES:
        return EVENT_CATEGORIES[event]
    return "OUT"


def encode_base_out_state(outs: int, on_1b: bool, on_2b: bool, on_3b: bool) -> int:
    """Encode base-out state as 0-23.

    base_state = 4*(on_3b) + 2*(on_2b) + 1*(on_1b)  -> 0-7
    state = base_state * 3 + outs                      -> 0-23
    """
    base_state = int(on_3b) * 4 + int(on_2b) * 2 + int(on_1b)
    return base_state * 3 + outs


def decode_base_out_state(state: int) -> tuple[int, str]:
    """Decode a 0-23 state into (outs, runners_string).

    Returns e.g. (1, "1-3") for 1 out with runners on 1st and 3rd.
    """
    base_state = state // 3
    outs = state % 3
    on_1b = bool(base_state & 1)
    on_2b = bool(base_state & 2)
    on_3b = bool(base_state & 4)
    runners = (
        ("1" if on_1b else "-") + ("2" if on_2b else "-") + ("3" if on_3b else "-")
    )
    return outs, runners


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
  AND game_type = 'R'
  AND bat_score IS NOT NULL
  AND post_bat_score IS NOT NULL
ORDER BY game_pk, at_bat_number
"""


def _fetch_pa_data(client: Client, season: int) -> pl.DataFrame:
    """Fetch all plate appearances for a season and return as Polars DataFrame."""
    result = client.query(_PA_QUERY, parameters={"season": season})
    columns = [
        "game_pk",
        "inning",
        "inning_topbot",
        "at_bat_number",
        "batter",
        "outs_when_up",
        "r1",
        "r2",
        "r3",
        "events",
        "bat_score",
        "post_bat_score",
    ]
    if not result.result_rows:
        return pl.DataFrame(
            schema={
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
        )
    return pl.DataFrame(result.result_rows, schema=columns, orient="row")


def compute_re_matrix(
    client: Client,
    season: int,
) -> dict[int, float]:
    """Compute the RE24 matrix for a season from game data.

    Returns a dict mapping base_out_state (0-23) to expected runs.
    Also inserts results into season_re_matrix table.
    """
    logger.info("Computing RE matrix for %d", season)
    df = _fetch_pa_data(client, season)
    if df.is_empty():
        logger.warning("No PA data found for season %d", season)
        return {}

    df = df.with_columns(base_out_state_expr().alias("base_out_state"))

    # Compute runs remaining from each PA's perspective within the half-inning
    df = df.with_columns(
        [
            pl.col("bat_score").first().over(HALF_INNING_COLS).alias("inning_start"),
            pl.col("post_bat_score").last().over(HALF_INNING_COLS).alias("inning_end"),
        ]
    )
    df = df.with_columns(
        (
            pl.col("inning_end")
            - pl.col("inning_start")
            - (pl.col("bat_score") - pl.col("inning_start"))
        ).alias("runs_remaining")
    )

    # Average runs remaining by base-out state
    re_df = (
        df.group_by("base_out_state")
        .agg(
            [
                pl.col("runs_remaining").mean().alias("expected_runs"),
                pl.col("runs_remaining").count().alias("occurrences"),
            ]
        )
        .sort("base_out_state")
    )

    re_matrix: dict[int, float] = {}
    rows_to_insert = []
    for row in re_df.iter_rows(named=True):
        state = row["base_out_state"]
        er = row["expected_runs"]
        occ = row["occurrences"]
        re_matrix[state] = er
        outs, runners = decode_base_out_state(state)
        rows_to_insert.append([season, state, outs, runners, er, occ])

    if rows_to_insert:
        delete_season(client, "season_re_matrix", season)
        client.insert(
            "season_re_matrix",
            rows_to_insert,
            column_names=[
                "season",
                "base_out_state",
                "outs",
                "runners_on",
                "expected_runs",
                "occurrences",
            ],
        )
        logger.info("Inserted %d RE matrix entries for %d", len(rows_to_insert), season)

    return re_matrix


def _apply_re_mapping(
    df: pl.DataFrame,
    re_matrix: dict[int, float],
) -> pl.DataFrame:
    """Add re_pre, re_post, runs_scored, and run_value columns."""
    # Next PA's base-out state within the same half-inning
    df = df.with_columns(
        [
            pl.col("base_out_state")
            .shift(-1)
            .over(HALF_INNING_COLS)
            .alias("next_base_out_state"),
            pl.col("game_pk").shift(-1).over(HALF_INNING_COLS).alias("next_game_pk"),
        ]
    )
    df = df.with_columns(pl.col("next_game_pk").is_null().alias("is_terminal"))

    # Map RE values
    df = df.with_columns(re_map_expr(re_matrix, "base_out_state").alias("re_pre"))
    df = df.with_columns(
        pl.when(pl.col("is_terminal"))
        .then(pl.lit(0.0))
        .otherwise(re_map_expr(re_matrix, "next_base_out_state"))
        .alias("re_post")
    )

    # Run value = RE(post) - RE(pre) + runs_scored
    df = df.with_columns(
        (pl.col("post_bat_score") - pl.col("bat_score")).alias("runs_scored")
    )
    df = df.with_columns(
        (pl.col("re_post") - pl.col("re_pre") + pl.col("runs_scored")).alias(
            "run_value"
        )
    )
    return df


def compute_linear_weights(
    client: Client,
    season: int,
    re_matrix: dict[int, float] | None = None,
) -> dict[str, float]:
    """Derive custom linear weights from the RE24 matrix.

    If re_matrix is not provided, reads from season_re_matrix table.
    Returns the weights dict and inserts into season_linear_weights.
    """
    logger.info("Computing linear weights for %d", season)

    if re_matrix is None:
        re_matrix = load_re_matrix(client, season)
    if not re_matrix:
        msg = f"No RE matrix found for season {season}. Run compute re-matrix first."
        raise ValueError(msg)

    df = _fetch_pa_data(client, season)
    if df.is_empty():
        msg = f"No PA data found for season {season}"
        raise ValueError(msg)

    df = df.with_columns(base_out_state_expr().alias("base_out_state"))
    df = _apply_re_mapping(df, re_matrix)

    # Categorize events
    df = df.with_columns(
        pl.col("events")
        .replace_strict(EVENT_CATEGORIES, default="OUT")
        .alias("event_cat")
    )

    # Average run value by event category
    weights_df = df.group_by("event_cat").agg(
        pl.col("run_value").mean().alias("avg_run_value")
    )
    raw_weights: dict[str, float] = {}
    for row in weights_df.iter_rows(named=True):
        raw_weights[row["event_cat"]] = row["avg_run_value"]

    run_out = raw_weights.get("OUT", 0.0)

    # Weights above outs
    event_keys = ["BB", "HBP", "1B", "2B", "3B", "HR"]
    weight_above_out = {k: raw_weights.get(k, 0.0) - run_out for k in event_keys}

    # Compute league OBP and wOBA for scaling
    lg_stats = client.query(
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
    )
    lg = lg_stats.result_rows[0]
    hits, walks, hbp, ab, sf, singles, doubles, triples, hr = lg

    lg_obp_denom = ab + walks + hbp + sf
    lg_obp = (hits + walks + hbp) / lg_obp_denom if lg_obp_denom > 0 else 0.0

    # Compute unscaled lg_wOBA using weights above outs
    woba_denom = ab + walks + hbp + sf
    if woba_denom > 0:
        lg_woba_unscaled = (
            weight_above_out["BB"] * walks
            + weight_above_out["HBP"] * hbp
            + weight_above_out["1B"] * singles
            + weight_above_out["2B"] * doubles
            + weight_above_out["3B"] * triples
            + weight_above_out["HR"] * hr
        ) / woba_denom
    else:
        lg_woba_unscaled = 0.0

    # wOBA scale: maps wOBA to OBP scale
    woba_scale = lg_obp / lg_woba_unscaled if lg_woba_unscaled != 0 else 1.0

    # Final scaled weights
    final_weights = {f"w{k}": weight_above_out[k] * woba_scale for k in event_keys}

    # League wOBA (using final weights)
    if woba_denom > 0:
        lg_woba = (
            final_weights["wBB"] * walks
            + final_weights["wHBP"] * hbp
            + final_weights["w1B"] * singles
            + final_weights["w2B"] * doubles
            + final_weights["w3B"] * triples
            + final_weights["wHR"] * hr
        ) / woba_denom
    else:
        lg_woba = 0.0

    # League runs per PA
    total_pa_result = client.query(
        """
        SELECT sum(pa) AS total_pa
        FROM player_season_hitting FINAL
        WHERE season = {season:UInt16}
        """,
        parameters={"season": season},
    )
    total_pa = total_pa_result.result_rows[0][0]

    # Total runs scored in season (from pitches)
    total_runs_result = client.query(
        """
        SELECT sum(post_bat_score - bat_score) AS total_runs
        FROM pitches
        WHERE game_year = {season:UInt16}
          AND events IS NOT NULL
          AND game_type = 'R'
          AND bat_score IS NOT NULL
          AND post_bat_score IS NOT NULL
        """,
        parameters={"season": season},
    )
    total_runs = total_runs_result.result_rows[0][0]
    lg_r_pa = total_runs / total_pa if total_pa > 0 else 0.0

    result = {
        "wBB": final_weights["wBB"],
        "wHBP": final_weights["wHBP"],
        "w1B": final_weights["w1B"],
        "w2B": final_weights["w2B"],
        "w3B": final_weights["w3B"],
        "wHR": final_weights["wHR"],
        "run_out": run_out,
        "lg_woba": lg_woba,
        "woba_scale": woba_scale,
        "lg_r_pa": lg_r_pa,
    }

    # Insert into DB
    client.command(
        "ALTER TABLE season_linear_weights DELETE WHERE season = {season:UInt16} AND source = 'custom'",
        parameters={"season": season},
    )
    client.insert(
        "season_linear_weights",
        [
            [season, "custom"]
            + [
                result[k]
                for k in [
                    "wBB",
                    "wHBP",
                    "w1B",
                    "w2B",
                    "w3B",
                    "wHR",
                    "run_out",
                    "lg_woba",
                    "woba_scale",
                    "lg_r_pa",
                ]
            ]
        ],
        column_names=[
            "season",
            "source",
            "wBB",
            "wHBP",
            "w1B",
            "w2B",
            "w3B",
            "wHR",
            "run_out",
            "lg_woba",
            "woba_scale",
            "lg_r_pa",
        ],
    )
    logger.info("Inserted custom linear weights for %d", season)

    return result


def compute_player_re24(
    client: Client,
    season: int,
    re_matrix: dict[int, float] | None = None,
    min_pa: int = 50,
) -> int:
    """Compute per-player RE24 totals for a season.

    Returns the number of players inserted.
    """
    logger.info("Computing player RE24 for %d (min_pa=%d)", season, min_pa)

    if re_matrix is None:
        re_matrix = load_re_matrix(client, season)
    if not re_matrix:
        msg = f"No RE matrix found for season {season}. Run compute re-matrix first."
        raise ValueError(msg)

    df = _fetch_pa_data(client, season)
    if df.is_empty():
        logger.warning("No PA data found for season %d", season)
        return 0

    df = df.with_columns(base_out_state_expr().alias("base_out_state"))
    df = _apply_re_mapping(df, re_matrix)

    # Aggregate by batter
    player_df = (
        df.group_by("batter")
        .agg(
            [
                pl.col("run_value").count().alias("pa"),
                pl.col("run_value").sum().alias("re24"),
            ]
        )
        .filter(pl.col("pa") >= min_pa)
        .with_columns((pl.col("re24") / pl.col("pa")).alias("re24_per_pa"))
        .sort("re24", descending=True)
    )

    rows = [
        [row["batter"], season, row["pa"], row["re24"], row["re24_per_pa"]]
        for row in player_df.iter_rows(named=True)
    ]

    if rows:
        delete_season(client, "player_season_re24", season)
        client.insert(
            "player_season_re24",
            rows,
            column_names=["player_id", "season", "pa", "re24", "re24_per_pa"],
        )
        logger.info("Inserted RE24 for %d players in %d", len(rows), season)

    return len(rows)
