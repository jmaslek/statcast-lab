"""Batter batted ball profiles: launch angle/velocity distributions, spray tendencies."""

import polars as pl
from loguru import logger

from pipeline.compute._common import Client, delete_season


def compute_batted_ball_for_season(
    client: Client,
    season: int,
    min_bbe: int = 25,
) -> int:
    """Compute batted ball profiles for a season. Returns row count written."""
    logger.info(
        "Computing batted ball profiles for %d (min_bbe=%d)...", season, min_bbe
    )

    result = client.query(
        """
        SELECT
            batter,
            count() AS bbe,

            -- Batted ball type counts
            countIf(bb_type = 'ground_ball') AS gb,
            countIf(bb_type = 'fly_ball') AS fb,
            countIf(bb_type = 'line_drive') AS ld,
            countIf(bb_type = 'popup') AS popup,

            -- Spray direction (spray_angle from hc_x/hc_y, per-pitch stand)
            -- Home plate at ~(128, 208). Negative angle = left field, positive = right field.
            countIf(
                hc_x IS NOT NULL AND hc_y IS NOT NULL AND (
                    (stand = 'R' AND atan2(hc_x - 128, 208 - hc_y) * 180 / pi() < -15)
                    OR (stand = 'L' AND atan2(hc_x - 128, 208 - hc_y) * 180 / pi() > 15)
                )
            ) AS pull_count,
            countIf(
                hc_x IS NOT NULL AND hc_y IS NOT NULL
                AND abs(atan2(hc_x - 128, 208 - hc_y) * 180 / pi()) <= 15
            ) AS center_count,
            countIf(
                hc_x IS NOT NULL AND hc_y IS NOT NULL AND (
                    (stand = 'R' AND atan2(hc_x - 128, 208 - hc_y) * 180 / pi() > 15)
                    OR (stand = 'L' AND atan2(hc_x - 128, 208 - hc_y) * 180 / pi() < -15)
                )
            ) AS oppo_count,

            -- Quality metrics
            countIf(launch_angle BETWEEN 8 AND 32) AS sweet_spot,
            countIf(barrel = 1) AS barrel_count,
            countIf(launch_speed >= 95) AS hard_hit_count,

            -- Averages
            avg(launch_angle) AS avg_la,
            avg(launch_speed) AS avg_ev,
            max(launch_speed) AS max_ev

        FROM pitches
        WHERE game_year = {season:UInt16}
          AND game_type = 'R'
          AND events IS NOT NULL
          AND bb_type IS NOT NULL
        GROUP BY batter
        HAVING bbe >= {min_bbe:UInt32}
        ORDER BY batter
        """,
        parameters={"season": season, "min_bbe": min_bbe},
    )

    if not result.result_rows:
        logger.warning("No batted ball data found for %d", season)
        return 0

    columns = [
        "batter",
        "bbe",
        "gb",
        "fb",
        "ld",
        "popup",
        "pull_count",
        "center_count",
        "oppo_count",
        "sweet_spot",
        "barrel_count",
        "hard_hit_count",
        "avg_la",
        "avg_ev",
        "max_ev",
    ]
    df = pl.DataFrame(result.result_rows, schema=columns, orient="row")

    logger.info("Processing %d batter rows...", len(df))

    df = df.with_columns(
        [
            pl.lit(season).cast(pl.UInt16).alias("season"),
            pl.col("avg_la").round(1),
            pl.col("avg_ev").round(1),
            pl.col("max_ev").round(1),
        ]
    )

    final = df.select(
        [
            "batter",
            "season",
            "bbe",
            "gb",
            "fb",
            "ld",
            "popup",
            "pull_count",
            "center_count",
            "oppo_count",
            "sweet_spot",
            "barrel_count",
            "hard_hit_count",
            "avg_la",
            "avg_ev",
            "max_ev",
        ]
    )

    logger.info("Writing batted ball data for %d rows...", len(final))
    delete_season(client, "batter_batted_ball", season)

    client.insert(
        "batter_batted_ball",
        final.rows(),
        column_names=[
            "batter",
            "season",
            "bbe",
            "gb",
            "fb",
            "ld",
            "popup",
            "pull_count",
            "center_count",
            "oppo_count",
            "sweet_spot",
            "barrel_count",
            "hard_hit_count",
            "avg_la",
            "avg_ev",
            "max_ev",
        ],
    )

    logger.info("Wrote %d batted ball rows for %d", len(final), season)
    return len(final)
