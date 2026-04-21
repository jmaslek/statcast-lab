from contextlib import contextmanager
from unittest.mock import MagicMock, patch

from litestar.di import Provide
from litestar.testing import TestClient

from backend.app import app
from backend.models.hitting import HittingLeaderRow
from backend.models.pitching import PitchingLeaderRow


def _make_mock_client():
    """Return a mock ClickHouse client with empty result sets."""
    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.result_rows = []
    mock_client.query.return_value = mock_result
    return mock_client


@contextmanager
def _client_with_mock_dependency(mock_client: MagicMock):
    original_provider = app.dependencies["client"]
    app.dependencies["client"] = Provide(
        lambda: mock_client,
        use_cache=True,
        sync_to_thread=False,
    )
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependencies["client"] = original_provider


def test_hitting_leaderboard_returns_200():
    mock_client = _make_mock_client()
    with patch("backend.api.hitting.get_hitting_leaderboard", return_value=([], 0)):
        with _client_with_mock_dependency(mock_client) as client:
            response = client.get("/api/hitting/leaderboard?season=2024&min_pa=50")
            assert response.status_code == 200
            data = response.json()
            assert "players" in data
            assert "season" in data
            assert data["season"] == 2024
            assert "total" in data
            assert data["total"] == 0
            assert data["players"] == []


def test_hitting_leaderboard_default_params():
    mock_client = _make_mock_client()
    with patch("backend.api.hitting.get_hitting_leaderboard", return_value=([], 0)):
        with _client_with_mock_dependency(mock_client) as client:
            response = client.get("/api/hitting/leaderboard")
            assert response.status_code == 200
            data = response.json()
            assert data["players"] == []
            assert data["total"] == 0


def test_pitching_leaderboard_returns_200():
    mock_client = _make_mock_client()
    with patch("backend.api.pitching.get_pitching_leaderboard", return_value=([], 0)):
        with _client_with_mock_dependency(mock_client) as client:
            response = client.get(
                "/api/pitching/leaderboard?season=2024&min_pitches=100"
            )
            assert response.status_code == 200
            data = response.json()
            assert "players" in data
            assert "season" in data
            assert data["season"] == 2024
            assert "total" in data


def test_pitching_leaderboard_default_params():
    mock_client = _make_mock_client()
    with patch("backend.api.pitching.get_pitching_leaderboard", return_value=([], 0)):
        with _client_with_mock_dependency(mock_client) as client:
            response = client.get("/api/pitching/leaderboard")
            assert response.status_code == 200
            data = response.json()
            assert data["players"] == []
            assert data["total"] == 0


def test_hitting_leaderboard_with_data():
    mock_client = MagicMock()
    rows = [
        HittingLeaderRow(
            player_id=12345,
            name="Test Player",
            pa=500,
            ab=450,
            hits=135,
            home_runs=30,
            walks=40,
            strikeouts=100,
            avg=0.300,
            obp=0.360,
            slg=0.533,
            ops=0.893,
            barrel_pct=10.0,
            avg_exit_velo=90.5,
            hard_hit_pct=40.0,
            xba=0.295,
            xwoba=0.380,
            woba=0.377,
            wrc_plus=142.4,
        )
    ]

    with patch("backend.api.hitting.get_hitting_leaderboard", return_value=(rows, 1)):
        with _client_with_mock_dependency(mock_client) as client:
            response = client.get("/api/hitting/leaderboard?season=2024")
            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 1
            player = data["players"][0]
            assert player["player_id"] == 12345
            assert player["name"] == "Test Player"
            assert player["pa"] == 500
            assert player["ab"] == 450
            assert player["hits"] == 135
            assert player["home_runs"] == 30
            # avg = 135/450 = 0.3
            assert abs(player["avg"] - 0.3) < 0.001
            # obp = (135+40+5)/(450+40+5+5) = 180/500 = 0.36
            assert abs(player["obp"] - 0.36) < 0.001
            # slg = 240/450 = 0.5333...
            assert abs(player["slg"] - 0.533) < 0.01
            # ops = obp + slg = 0.36 + 0.533 = 0.893
            assert abs(player["ops"] - 0.893) < 0.01
            # barrel_pct = 40/400 * 100 = 10.0
            assert abs(player["barrel_pct"] - 10.0) < 0.1
            # hard_hit_pct = 160/400 * 100 = 40.0
            assert abs(player["hard_hit_pct"] - 40.0) < 0.1
            # avg_exit_velo = 90.5
            assert abs(player["avg_exit_velo"] - 90.5) < 0.1


def test_pitching_leaderboard_with_data():
    mock_client = MagicMock()
    rows = [
        PitchingLeaderRow(
            player_id=54321,
            name="Test Pitcher",
            total_pitches=3000,
            batters_faced=800,
            strikeouts=200,
            walks=60,
            hits_allowed=150,
            home_runs_allowed=20,
            k_pct=25.0,
            bb_pct=7.5,
            whiff_pct=26.7,
            csw_pct=30.0,
            avg_velo=95.5,
            avg_spin=2300.0,
        )
    ]

    with patch("backend.api.pitching.get_pitching_leaderboard", return_value=(rows, 1)):
        with _client_with_mock_dependency(mock_client) as client:
            response = client.get("/api/pitching/leaderboard?season=2024")
            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 1
            player = data["players"][0]
            assert player["player_id"] == 54321
            assert player["name"] == "Test Pitcher"
            assert player["total_pitches"] == 3000
            assert player["batters_faced"] == 800
            # k_pct = 200/800 * 100 = 25.0
            assert abs(player["k_pct"] - 25.0) < 0.1
            # bb_pct = 60/800 * 100 = 7.5
            assert abs(player["bb_pct"] - 7.5) < 0.1
            # whiff_pct = 400/1500 * 100 = 26.67
            assert abs(player["whiff_pct"] - 26.7) < 0.1
            # csw_pct = (500+400)/3000 * 100 = 30.0
            assert abs(player["csw_pct"] - 30.0) < 0.1
            # avg_velo = 95.5
            assert abs(player["avg_velo"] - 95.5) < 0.1
            # avg_spin = 2300
            assert abs(player["avg_spin"] - 2300.0) < 0.1
