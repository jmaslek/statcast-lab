"""Tests for ClickHouse materialized views."""

import clickhouse_connect
import pytest


@pytest.fixture
def ch_client():
    client = clickhouse_connect.get_client(
        host="localhost", port=8123, username="mlb", password="mlb", database="mlb"
    )
    yield client
    client.close()


def test_create_season_hitting_mv(ch_client):
    from pipeline.schema import create_materialized_views

    create_materialized_views(ch_client)

    result = ch_client.query("DESCRIBE TABLE player_season_hitting")
    column_names = [row[0] for row in result.result_rows]

    assert "batter" in column_names
    assert "season" in column_names
    assert "pa" in column_names
    assert "hits" in column_names
    assert "home_runs" in column_names
    assert "launch_speed_sum" in column_names
    assert "launch_speed_count" in column_names


def test_create_season_pitching_mv(ch_client):
    from pipeline.schema import create_materialized_views

    create_materialized_views(ch_client)

    result = ch_client.query("DESCRIBE TABLE player_season_pitching")
    column_names = [row[0] for row in result.result_rows]

    assert "pitcher" in column_names
    assert "season" in column_names
    assert "total_pitches" in column_names
    assert "release_speed_sum" in column_names
    assert "release_speed_count" in column_names
    assert "spin_rate_sum" in column_names
    assert "spin_rate_count" in column_names
