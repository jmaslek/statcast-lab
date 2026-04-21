import polars as pl
from loguru import logger

from pipeline.compute._common import Client, delete_season


def compute_batted_ball_for_season(
    client: Client,
    season: int,
    min_bbe: int = 25,
) -> int:
    logger.info("Batted ball for {} (min_bbe={})", season, min_bbe)

    # Spray angle comes from hc_x / hc_y with home plate at roughly (128, 208).
    # Negative angle = left field, positive = right. Pull/center/oppo buckets
    # are defined relative to the batter's stand so left-handers pull to RF.
    result = client.query(
        """
        SELECT
            batter,
            count() AS bbe,
            countIf(bb_type = 'ground_ball') AS gb,
            countIf(bb_type = 'fly_ball') AS fb,
            countIf(bb_type = 'line_drive') AS ld,
            countIf(bb_type = 'popup') AS popup,
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
            countIf(launch_angle BETWEEN 8 AND 32) AS sweet_spot,
            countIf(barrel = 1) AS barrel_count,
            countIf(launch_speed >= 95) AS hard_hit_count,
            avg(launch_angle) AS avg_la,
            avg(launch_speed) AS avg_ev,
            max(launch_speed) AS max_ev
        FROM pitches
        WHERE game_year = {season:UInt16}
          AND game_type = 'R'
          AND events IS NOT NULL AND events != 'truncated_pa'
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

    final = df.with_columns([
        pl.lit(season).cast(pl.UInt16).alias("season"),
        pl.col("avg_la").round(1),
        pl.col("avg_ev").round(1),
        pl.col("max_ev").round(1),
    ]).select([
        "batter", "season", "bbe",
        "gb", "fb", "ld", "popup",
        "pull_count", "center_count", "oppo_count",
        "sweet_spot", "barrel_count", "hard_hit_count",
        "avg_la", "avg_ev", "max_ev",
    ])

    delete_season(client, "batter_batted_ball", season)
    client.insert_df("batter_batted_ball", final.to_pandas())

    logger.info("Wrote {} batted ball rows for {}", len(final), season)
    return len(final)
