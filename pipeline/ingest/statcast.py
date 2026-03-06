"""Statcast data ingestion: pybaseball -> Polars -> ClickHouse."""

from datetime import date, timedelta

import pandas as pd
import polars as pl
import pybaseball
from loguru import logger

# Column names matching the pitches table DDL in pipeline/schema.py
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
    """Transform a pandas DataFrame from pybaseball into a Polars DataFrame.

    Keeps only columns present in both STATCAST_COLUMNS and the input DataFrame,
    converts to Polars, and ensures game_date is a Date type.
    """
    # Keep only columns that exist in both the data and our schema
    cols_to_keep = [c for c in STATCAST_COLUMNS if c in pdf.columns]
    pdf = pdf[cols_to_keep].copy()

    # Ensure game_date is datetime before conversion
    if "game_date" in pdf.columns:
        pdf["game_date"] = pd.to_datetime(pdf["game_date"])

    df = pl.from_pandas(pdf)

    # Ensure game_date is Date type (not Datetime)
    if "game_date" in df.columns:
        if df["game_date"].dtype != pl.Date:
            df = df.with_columns(pl.col("game_date").cast(pl.Date))

    return df


def insert_pitches(client, df: pl.DataFrame) -> int:
    """Insert a Polars DataFrame of pitches into ClickHouse.

    Returns the number of rows inserted.
    """
    if df.is_empty():
        return 0

    pdf = df.to_pandas()
    client.insert_df("pitches", pdf)
    return len(df)


def fetch_and_load(
    client,
    start: date,
    end: date,
    chunk_days: int = 7,
) -> int:
    """Fetch Statcast data in weekly chunks and load into ClickHouse.

    Args:
        client: ClickHouse client instance.
        start: Start date (inclusive).
        end: End date (inclusive).
        chunk_days: Number of days per chunk.

    Returns:
        Total number of rows loaded.
    """
    total_rows = 0
    current = start

    while current <= end:
        chunk_end = min(current + timedelta(days=chunk_days - 1), end)
        start_str = current.strftime("%Y-%m-%d")
        end_str = chunk_end.strftime("%Y-%m-%d")

        logger.info("Fetching statcast data: %s to %s", start_str, end_str)

        try:
            pdf = pybaseball.statcast(start_dt=start_str, end_dt=end_str)

            if pdf is None or pdf.empty:
                logger.info("No data returned for %s to %s", start_str, end_str)
                current = chunk_end + timedelta(days=1)
                continue

            df = transform_statcast_df(pdf)
            insert_pitches(client, df)
            total_rows += len(df)
            logger.info("Inserted %d rows for %s to %s", len(df), start_str, end_str)

        except Exception:
            logger.exception("Error processing chunk %s to %s", start_str, end_str)

        current = chunk_end + timedelta(days=1)

    logger.info("Total rows loaded: %d", total_rows)
    return total_rows
