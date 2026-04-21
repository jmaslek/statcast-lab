"""Batter stats split by pitcher handedness (vs LHP / vs RHP)."""

import polars as pl
from loguru import logger

from pipeline.compute._common import Client, delete_season


def compute_platoon_splits_for_season(
    client: Client,
    season: int,
    min_pa: int = 30,
) -> int:
    logger.info("Platoon splits for {} (min_pa={})", season, min_pa)

    # AB definition mirrors player_season_hitting_mv to keep numbers consistent.
    result = client.query(
        """
        SELECT
            batter,
            p_throws,
            count() AS pa,
            countIf(events IN (
                'single', 'double', 'triple', 'home_run',
                'field_out', 'strikeout', 'double_play', 'force_out',
                'grounded_into_double_play', 'fielders_choice', 'fielders_choice_out',
                'field_error', 'strikeout_double_play', 'triple_play',
                'sac_bunt_double_play'
            )) AS ab,
            countIf(events IN ('single', 'double', 'triple', 'home_run')) AS hits,
            countIf(events = 'home_run') AS home_runs,
            countIf(events = 'walk') AS walks,
            countIf(events IN ('strikeout', 'strikeout_double_play')) AS strikeouts,
            countIf(events = 'hit_by_pitch') AS hbp,
            countIf(events = 'sac_fly') AS sac_flies,
            countIf(events = 'single')
                + countIf(events = 'double') * 2
                + countIf(events = 'triple') * 3
                + countIf(events = 'home_run') * 4 AS total_bases,
            countIf(barrel = 1) AS barrel_count,
            countIf(launch_speed IS NOT NULL) AS batted_ball_events,
            countIf(launch_speed >= 95) AS hard_hit_count,
            ifNull(sumIf(estimated_woba_using_speedangle,
                         estimated_woba_using_speedangle IS NOT NULL), 0) AS xwoba_sum,
            countIf(estimated_woba_using_speedangle IS NOT NULL) AS xwoba_count
        FROM pitches
        WHERE game_year = {season:UInt16}
          AND game_type = 'R'
          AND events IS NOT NULL AND events != 'truncated_pa'
        GROUP BY batter, p_throws
        HAVING pa >= {min_pa:UInt32}
        ORDER BY batter, p_throws
        """,
        parameters={"season": season, "min_pa": min_pa},
    )

    if not result.result_rows:
        logger.warning("No platoon split data found for %d", season)
        return 0

    columns = [
        "batter",
        "p_throws",
        "pa",
        "ab",
        "hits",
        "home_runs",
        "walks",
        "strikeouts",
        "hbp",
        "sac_flies",
        "total_bases",
        "barrel_count",
        "batted_ball_events",
        "hard_hit_count",
        "xwoba_sum",
        "xwoba_count",
    ]
    df = pl.DataFrame(result.result_rows, schema=columns, orient="row")

    final = df.with_columns(
        pl.lit(season).cast(pl.UInt16).alias("season"),
    ).select([
        "batter", "season", "p_throws",
        "pa", "ab", "hits", "home_runs", "walks", "strikeouts",
        "hbp", "sac_flies", "total_bases",
        "barrel_count", "batted_ball_events", "hard_hit_count",
        "xwoba_sum", "xwoba_count",
    ])

    delete_season(client, "batter_platoon_splits", season)
    client.insert_df("batter_platoon_splits", final.to_pandas())

    logger.info("Wrote {} platoon split rows for {}", len(final), season)
    return len(final)
