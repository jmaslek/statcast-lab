import polars as pl
from loguru import logger

from pipeline.compute._common import Client, delete_season


def compute_arsenal_for_season(
    client: Client,
    season: int,
    min_pitches: int = 50,
) -> int:
    logger.info("Arsenal profiles for {} (min_pitches={})", season, min_pitches)

    # pfx_x / pfx_z come from Statcast in feet; convert to inches for display.
    result = client.query(
        """
        SELECT
            pitcher,
            pitch_type,
            any(pitch_name) AS pitch_name,
            count() AS pitch_count,
            avg(release_speed) AS avg_velo,
            max(release_speed) AS max_velo,
            avg(release_spin_rate) AS avg_spin,
            avg(pfx_x) * 12 AS avg_pfx_x,
            avg(pfx_z) * 12 AS avg_pfx_z,
            countIf(description IN (
                'swinging_strike', 'swinging_strike_blocked', 'foul_tip'
            )) AS whiffs,
            countIf(description IN (
                'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip',
                'hit_into_play', 'hit_into_play_no_out', 'hit_into_play_score'
            )) AS swings,
            countIf(description = 'called_strike') AS called_strikes,
            countIf(zone BETWEEN 1 AND 9) AS in_zone,
            countIf(NOT (zone BETWEEN 1 AND 9)) AS out_of_zone,
            countIf(
                NOT (zone BETWEEN 1 AND 9)
                AND description IN (
                    'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip',
                    'hit_into_play', 'hit_into_play_no_out', 'hit_into_play_score'
                )
            ) AS chases,
            countIf(strikes = 2) AS two_strike_pitches,
            countIf(strikes = 2 AND events IN ('strikeout', 'strikeout_double_play')) AS put_aways,
            avgIf(launch_speed, launch_speed IS NOT NULL) AS avg_exit_velo_raw,
            countIf(bb_type = 'ground_ball') AS ground_balls,
            countIf(bb_type IS NOT NULL) AS total_batted_balls
        FROM pitches
        WHERE game_year = {season:UInt16}
          AND game_type = 'R'
          AND pitch_type IS NOT NULL
          AND pitch_type != ''
        GROUP BY pitcher, pitch_type
        HAVING pitch_count >= {min_pitches:UInt32}
        ORDER BY pitcher, pitch_count DESC
        """,
        parameters={"season": season, "min_pitches": min_pitches},
    )

    if not result.result_rows:
        logger.warning("No arsenal data found for %d", season)
        return 0

    columns = [
        "pitcher",
        "pitch_type",
        "pitch_name",
        "pitch_count",
        "avg_velo",
        "max_velo",
        "avg_spin",
        "avg_pfx_x",
        "avg_pfx_z",
        "whiffs",
        "swings",
        "called_strikes",
        "in_zone",
        "out_of_zone",
        "chases",
        "two_strike_pitches",
        "put_aways",
        "avg_exit_velo_raw",
        "ground_balls",
        "total_batted_balls",
    ]
    df = pl.DataFrame(result.result_rows, schema=columns, orient="row")

    # Usage % divides by the pitcher's full pitch count, not just qualifying
    # pitch types, so low-usage offerings still show a realistic share.
    totals_result = client.query(
        """
        SELECT pitcher, count() AS total_pitches
        FROM pitches
        WHERE game_year = {season:UInt16}
          AND game_type = 'R'
          AND pitch_type IS NOT NULL
          AND pitch_type != ''
        GROUP BY pitcher
        """,
        parameters={"season": season},
    )
    pitcher_totals = pl.DataFrame(
        totals_result.result_rows,
        schema=["pitcher", "total_pitches"],
        orient="row",
    )
    df = df.join(pitcher_totals, on="pitcher")

    def _pct(num: pl.Expr, denom: pl.Expr) -> pl.Expr:
        return (
            pl.when(denom > 0).then(num / denom * 100).otherwise(0.0)
        ).round(1)

    df = df.with_columns(
        [
            (pl.col("pitch_count") / pl.col("total_pitches") * 100)
            .round(1)
            .alias("usage_pct"),
            _pct(pl.col("whiffs"), pl.col("swings")).alias("whiff_pct"),
            _pct(
                pl.col("called_strikes") + pl.col("whiffs"),
                pl.col("pitch_count"),
            ).alias("csw_pct"),
            _pct(pl.col("put_aways"), pl.col("two_strike_pitches")).alias("put_away_pct"),
            _pct(pl.col("in_zone"), pl.col("pitch_count")).alias("zone_pct"),
            _pct(pl.col("chases"), pl.col("out_of_zone")).alias("chase_pct"),
            _pct(pl.col("ground_balls"), pl.col("total_batted_balls")).alias("gb_pct"),
            pl.col("avg_velo").round(1),
            pl.col("max_velo").round(1),
            pl.col("avg_spin").round(0),
            pl.col("avg_pfx_x").round(1),
            pl.col("avg_pfx_z").round(1),
            pl.col("avg_exit_velo_raw").fill_null(0.0).round(1).alias("avg_exit_velo"),
        ]
    )

    final = df.select(
        [
            "pitcher",
            pl.lit(season).cast(pl.UInt16).alias("season"),
            "pitch_type",
            "pitch_name",
            "pitch_count",
            "usage_pct",
            "avg_velo",
            "max_velo",
            "avg_spin",
            "avg_pfx_x",
            "avg_pfx_z",
            "whiff_pct",
            "csw_pct",
            "put_away_pct",
            "zone_pct",
            "chase_pct",
            "avg_exit_velo",
            "gb_pct",
        ]
    )

    delete_season(client, "pitcher_arsenal", season)
    client.insert_df("pitcher_arsenal", final.to_pandas())

    logger.info("Wrote {} arsenal rows for {}", len(final), season)
    return len(final)
