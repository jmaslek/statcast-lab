"""Fetch boxscore + linescore from the MLB Stats API and map to our models."""

import httpx

from backend.models.games import (
    BoxscoreBatter,
    BoxscoreInning,
    BoxscorePitcher,
    BoxscoreResponse,
    BoxscoreTeam,
    BoxscoreTeamTotals,
)

MLB_API = "https://statsapi.mlb.com/api/v1"


async def fetch_boxscore(game_pk: int) -> BoxscoreResponse:
    """Fetch boxscore and linescore for a game from the MLB Stats API."""
    async with httpx.AsyncClient(timeout=15.0) as http:
        box_resp, line_resp = await _fetch_both(http, game_pk)

    innings = _parse_innings(line_resp)
    away = _parse_team(box_resp["teams"]["away"])
    home = _parse_team(box_resp["teams"]["home"])

    return BoxscoreResponse(
        game_pk=game_pk,
        innings=innings,
        away=away,
        home=home,
    )


async def _fetch_both(
    http: httpx.AsyncClient, game_pk: int
) -> tuple[dict, dict]:
    """Fetch boxscore and linescore concurrently."""
    import asyncio

    box_task = asyncio.create_task(
        _get_json(http, f"{MLB_API}/game/{game_pk}/boxscore")
    )
    line_task = asyncio.create_task(
        _get_json(http, f"{MLB_API}/game/{game_pk}/linescore")
    )
    return await box_task, await line_task


async def _get_json(http: httpx.AsyncClient, url: str) -> dict:
    resp = await http.get(url)
    resp.raise_for_status()
    return resp.json()


def _parse_innings(linescore: dict) -> list[BoxscoreInning]:
    innings = []
    for inn in linescore.get("innings", []):
        away = inn.get("away", {})
        home = inn.get("home", {})
        innings.append(
            BoxscoreInning(
                num=inn["num"],
                away_runs=away.get("runs", 0),
                away_hits=away.get("hits", 0),
                away_errors=away.get("errors", 0),
                home_runs=home.get("runs", 0),
                home_hits=home.get("hits", 0),
                home_errors=home.get("errors", 0),
            )
        )
    return innings


def _parse_team(team_data: dict) -> BoxscoreTeam:
    team_info = team_data.get("team", {})
    team_name = team_info.get("abbreviation") or team_info.get("name", "???")

    # Batting order -> player stats
    batting_order = team_data.get("battingOrder", [])
    players = team_data.get("players", {})

    batters = []
    for pid in batting_order:
        pkey = f"ID{pid}"
        pdata = players.get(pkey, {})
        person = pdata.get("person", {})
        game_stats = pdata.get("stats", {}).get("batting", {})
        season_stats = pdata.get("seasonStats", {}).get("batting", {})
        pos = pdata.get("position", {})
        batters.append(
            BoxscoreBatter(
                player_id=pid,
                name=person.get("fullName", str(pid)),
                position=pos.get("abbreviation", ""),
                batting_order=game_stats.get("note"),
                ab=game_stats.get("atBats", 0),
                r=game_stats.get("runs", 0),
                h=game_stats.get("hits", 0),
                rbi=game_stats.get("rbi", 0),
                bb=game_stats.get("baseOnBalls", 0),
                k=game_stats.get("strikeOuts", 0),
                avg=season_stats.get("avg") or game_stats.get("avg") or ".000",
                obp=season_stats.get("obp") or game_stats.get("obp") or ".000",
                slg=season_stats.get("slg") or game_stats.get("slg") or ".000",
                summary=game_stats.get("summary", ""),
            )
        )

    # Pitchers in appearance order
    pitcher_ids = team_data.get("pitchers", [])
    pitchers = []
    for pid in pitcher_ids:
        pkey = f"ID{pid}"
        pdata = players.get(pkey, {})
        person = pdata.get("person", {})
        game_stats = pdata.get("stats", {}).get("pitching", {})
        season_stats = pdata.get("seasonStats", {}).get("pitching", {})
        pitchers.append(
            BoxscorePitcher(
                player_id=pid,
                name=person.get("fullName", str(pid)),
                ip=game_stats.get("inningsPitched", "0.0"),
                h=game_stats.get("hits", 0),
                r=game_stats.get("runs", 0),
                er=game_stats.get("earnedRuns", 0),
                bb=game_stats.get("baseOnBalls", 0),
                k=game_stats.get("strikeOuts", 0),
                pitches=game_stats.get("pitchesThrown") or game_stats.get("numberOfPitches", 0),
                strikes=game_stats.get("strikes", 0),
                era=season_stats.get("era") or game_stats.get("era") or "-.--",
                summary=game_stats.get("summary", ""),
                note=game_stats.get("note"),
            )
        )

    # Team totals from linescore-style teamStats
    team_batting = team_data.get("teamStats", {}).get("batting", {})
    totals = BoxscoreTeamTotals(
        runs=team_batting.get("runs", 0),
        hits=team_batting.get("hits", 0),
        errors=0,  # errors come from fielding, not batting stats
        lob=team_batting.get("leftOnBase", 0),
    )

    return BoxscoreTeam(
        team_name=team_name,
        batters=batters,
        pitchers=pitchers,
        totals=totals,
    )
