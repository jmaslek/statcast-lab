import clickhouse_connect
import pytest


@pytest.fixture
def ch_client():
    """Connect to local ClickHouse. Requires `make db-up`."""
    client = clickhouse_connect.get_client(
        host="localhost", port=8123, username="mlb", password="mlb", database="mlb"
    )
    yield client
    client.close()


def test_create_pitches_table(ch_client):
    from pipeline.schema import create_pitches_table

    create_pitches_table(ch_client)

    # Verify table exists and has expected columns
    result = ch_client.query("DESCRIBE TABLE pitches")
    column_names = [row[0] for row in result.result_rows]

    assert "game_pk" in column_names
    assert "pitch_type" in column_names
    assert "release_speed" in column_names
    assert "launch_speed" in column_names
    assert "batter" in column_names
    assert "pitcher" in column_names
    assert "game_date" in column_names


def test_create_players_table(ch_client):
    from pipeline.schema import create_players_table

    create_players_table(ch_client)

    result = ch_client.query("DESCRIBE TABLE players")
    column_names = [row[0] for row in result.result_rows]

    assert "player_id" in column_names
    assert "name_first" in column_names
    assert "name_last" in column_names


def test_create_teams_table(ch_client):
    from pipeline.schema import create_teams_table

    create_teams_table(ch_client)

    result = ch_client.query("DESCRIBE TABLE teams")
    column_names = [row[0] for row in result.result_rows]

    assert "team_id" in column_names
    assert "team_name" in column_names
    assert "abbreviation" in column_names
