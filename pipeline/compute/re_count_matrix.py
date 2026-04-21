"""288-state RE matrix: 24 base-out states × 12 ball-strike counts.

Unlike the PA-level RE matrix, this operates on every pitch so we capture how
expected runs shift as the count progresses within a PA.
"""

import polars as pl
from loguru import logger

from pipeline.compute._common import Client, delete_season

_PITCH_QUERY = """
SELECT
    game_pk,
    inning,
    inning_topbot,
    at_bat_number,
    pitch_number,
    outs_when_up,
    on_1b IS NOT NULL AS r1,
    on_2b IS NOT NULL AS r2,
    on_3b IS NOT NULL AS r3,
    balls,
    strikes,
    bat_score,
    post_bat_score
FROM pitches
WHERE game_year = {season:UInt16}
  AND game_type = 'R'
  AND balls IS NOT NULL
  AND strikes IS NOT NULL
  AND bat_score IS NOT NULL
ORDER BY game_pk, inning, inning_topbot, at_bat_number, pitch_number
"""


def compute_re_count_matrix(client: Client, season: int) -> int:
    logger.info("Count-level RE matrix for {}", season)

    result = client.query(_PITCH_QUERY, parameters={"season": season})
    if not result.result_rows:
        logger.warning("No pitch data for {}", season)
        return 0

    columns = [
        "game_pk", "inning", "inning_topbot", "at_bat_number", "pitch_number",
        "outs_when_up", "r1", "r2", "r3", "balls", "strikes",
        "bat_score", "post_bat_score",
    ]
    df = pl.DataFrame(result.result_rows, schema=columns, orient="row")
    hi_cols = ["game_pk", "inning", "inning_topbot"]

    df = df.with_columns(
        (
            (pl.col("r3").cast(pl.UInt8) * 4
             + pl.col("r2").cast(pl.UInt8) * 2
             + pl.col("r1").cast(pl.UInt8))
            .mul(3)
            .add(pl.col("outs_when_up"))
        ).alias("base_out_state"),
        pl.col("post_bat_score").last().over(hi_cols).alias("inning_end_score"),
    ).with_columns(
        (pl.col("inning_end_score") - pl.col("bat_score")).alias("runs_remaining"),
    ).filter(
        pl.col("balls").is_between(0, 3) & pl.col("strikes").is_between(0, 2)
    )

    final = (
        df.group_by(["base_out_state", "balls", "strikes"])
        .agg([
            pl.col("runs_remaining").mean().alias("expected_runs"),
            pl.col("runs_remaining").len().alias("occurrences"),
        ])
        .sort(["base_out_state", "balls", "strikes"])
        .with_columns(pl.lit(season).cast(pl.UInt16).alias("season"))
        .select([
            "season", "base_out_state", "balls", "strikes",
            "expected_runs", "occurrences",
        ])
    )

    delete_season(client, "season_re_count_matrix", season)
    client.insert_df("season_re_count_matrix", final.to_pandas())

    logger.info("Wrote {} count-level RE states for {}", len(final), season)
    return len(final)
