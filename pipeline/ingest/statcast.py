"""pybaseball.statcast -> Polars -> ClickHouse."""

from datetime import date, timedelta

import pandas as pd
import polars as pl
import pybaseball
from loguru import logger

# Kept in sync with the `pitches` DDL in pipeline/schema.py. Fields that
# pybaseball doesn't return for a given date range are silently dropped.
STATCAST_COLUMNS: list[str] = [
    # Game context
    "game_pk",
    "game_date",
    "game_type",
    "home_team",
    "away_team",
    "inning",
    "inning_topbot",
    # At-bat context
    "at_bat_number",
    "pitch_number",
    "batter",
    "pitcher",
    "stand",
    "p_throws",
    "balls",
    "strikes",
    "outs_when_up",
    "on_1b",
    "on_2b",
    "on_3b",
    "fielder_2",
    # Pitch info
    "pitch_type",
    "pitch_name",
    "description",
    "events",
    "type",
    "zone",
    # Pitch physics
    "release_speed",
    "release_spin_rate",
    "release_extension",
    "release_pos_x",
    "release_pos_y",
    "release_pos_z",
    "spin_axis",
    "pfx_x",
    "pfx_z",
    "plate_x",
    "plate_z",
    "sz_top",
    "sz_bot",
    "vx0",
    "vy0",
    "vz0",
    "ax",
    "ay",
    "az",
    "effective_speed",
    # Batted ball
    "launch_speed",
    "launch_angle",
    "launch_speed_angle",
    "hit_distance_sc",
    "hc_x",
    "hc_y",
    "barrel",
    "babip_value",
    "iso_value",
    # Expected stats
    "estimated_ba_using_speedangle",
    "estimated_woba_using_speedangle",
    "estimated_slg_using_speedangle",
    # Scoring
    "bat_score",
    "fld_score",
    "post_bat_score",
    "post_fld_score",
    "delta_run_exp",
    # Win probability
    "delta_home_win_exp",
    "home_win_exp",
    "bat_win_exp",
    "delta_pitcher_run_exp",
    # Fielding context
    "if_fielding_alignment",
    "of_fielding_alignment",
    "hit_location",
    "bb_type",
    "fielder_3",
    "fielder_4",
    "fielder_5",
    "fielder_6",
    "fielder_7",
    "fielder_8",
    "fielder_9",
    # Swing tracking
    "bat_speed",
    "swing_length",
    "attack_angle",
    "swing_path_tilt",
    "intercept_ball_minus_batter_pos_x_inches",
    "intercept_ball_minus_batter_pos_y_inches",
    # Pitcher arm angle
    "arm_angle",
    # Break metrics
    "api_break_z_with_gravity",
    "api_break_x_arm",
    "api_break_x_batter_in",
    # Game context
    "n_thruorder_pitcher",
    "n_priorpa_thisgame_player_at_bat",
    # Validation
    "woba_value",
    "woba_denom",
    # Metadata
    "des",
    "sv_id",
    "game_year",
]


def transform_statcast_df(pdf: pd.DataFrame) -> pl.DataFrame:
    cols_to_keep = [c for c in STATCAST_COLUMNS if c in pdf.columns]
    pdf = pdf[cols_to_keep].copy()
    if "game_date" in pdf.columns:
        pdf["game_date"] = pd.to_datetime(pdf["game_date"])

    df = pl.from_pandas(pdf)
    if "game_date" in df.columns and df["game_date"].dtype != pl.Date:
        df = df.with_columns(pl.col("game_date").cast(pl.Date))
    return df


def insert_pitches(client, df: pl.DataFrame) -> int:
    if df.is_empty():
        return 0
    client.insert_df("pitches", df.to_pandas())
    return len(df)


def fetch_and_load(
    client,
    start: date,
    end: date,
    chunk_days: int = 7,
) -> int:
    """Fetch Statcast in `chunk_days`-wide windows, insert each chunk independently.

    A chunk that fails is logged and skipped — the function carries on so a
    single bad week doesn't abort an entire backfill. The count of failed
    chunks is logged at the end; callers that need strictness should check
    logs or re-run over the failed range.
    """
    total_rows = 0
    failed = 0
    current = start

    while current <= end:
        chunk_end = min(current + timedelta(days=chunk_days - 1), end)
        start_str = current.strftime("%Y-%m-%d")
        end_str = chunk_end.strftime("%Y-%m-%d")
        logger.info("Fetching {} to {}", start_str, end_str)

        try:
            pdf = pybaseball.statcast(start_dt=start_str, end_dt=end_str)
            if pdf is None or pdf.empty:
                logger.info("No data for {} to {}", start_str, end_str)
            else:
                df = transform_statcast_df(pdf)
                insert_pitches(client, df)
                total_rows += len(df)
                logger.info("Inserted {} rows for {} to {}", len(df), start_str, end_str)
        except Exception:
            failed += 1
            logger.exception("Chunk {} to {} failed", start_str, end_str)

        current = chunk_end + timedelta(days=1)

    if failed:
        logger.warning("{} chunk(s) failed — re-run those ranges to close gaps", failed)
    logger.info("Total rows loaded: {}", total_rows)
    return total_rows
