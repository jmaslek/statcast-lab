import polars as pl
import pandas as pd


def test_transform_statcast_df():
    """Test that pandas DataFrame from pybaseball is transformed to Polars correctly."""
    from pipeline.ingest.statcast import transform_statcast_df

    pdf = pd.DataFrame(
        {
            "game_pk": [717840, 717840],
            "game_date": pd.to_datetime(["2024-04-01", "2024-04-01"]),
            "pitch_type": ["FF", "SL"],
            "release_speed": [95.2, 84.1],
            "batter": [660271, 660271],
            "pitcher": [543037, 543037],
            "launch_speed": [102.3, None],
            "launch_angle": [25.0, None],
            "events": ["single", None],
            "description": ["hit_into_play", "called_strike"],
            "home_team": ["NYY", "NYY"],
            "away_team": ["BOS", "BOS"],
            "at_bat_number": [1, 1],
            "pitch_number": [1, 2],
            "game_year": [2024, 2024],
            "game_type": ["R", "R"],
        }
    )

    result = transform_statcast_df(pdf)

    assert isinstance(result, pl.DataFrame)
    assert len(result) == 2
    assert result["pitch_type"].dtype == pl.Utf8
    assert result["game_date"].dtype == pl.Date


def test_transform_handles_missing_columns():
    """Transform should handle columns missing from the DataFrame gracefully."""
    from pipeline.ingest.statcast import transform_statcast_df

    pdf = pd.DataFrame(
        {
            "game_pk": [717840],
            "game_date": pd.to_datetime(["2024-04-01"]),
            "batter": [660271],
            "pitcher": [543037],
            "at_bat_number": [1],
            "pitch_number": [1],
            "game_year": [2024],
            "description": ["called_strike"],
            "type": ["S"],
        }
    )

    result = transform_statcast_df(pdf)
    assert isinstance(result, pl.DataFrame)
    assert len(result) == 1
