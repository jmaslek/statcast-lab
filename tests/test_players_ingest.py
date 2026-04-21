import polars as pl


def test_fetch_teams_returns_dataframe():
    """Test that fetch_teams returns well-formed Polars DataFrame from live API."""
    from pipeline.ingest.players import fetch_teams

    result = fetch_teams()
    assert isinstance(result, pl.DataFrame)
    assert len(result) >= 30  # At least 30 MLB teams
    assert "team_id" in result.columns
    assert "team_name" in result.columns
    assert "abbreviation" in result.columns


def test_fetch_roster_returns_dataframe():
    """Test that fetch_roster returns player data for a known team."""
    from pipeline.ingest.players import fetch_roster

    # Yankees = team_id 147
    result = fetch_roster(147, 2024)
    assert isinstance(result, pl.DataFrame)
    assert len(result) > 0
    assert "player_id" in result.columns
    assert "name_full" in result.columns
    assert "position" in result.columns
