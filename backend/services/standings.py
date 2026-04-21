"""Fetch MLB standings from the MLB Stats API."""

import httpx

from backend.models.standings import (
    DivisionStandings,
    StandingsResponse,
    TeamRecord,
)

MLB_API = "https://statsapi.mlb.com/api/v1"

# League IDs: 103 = AL, 104 = NL
LEAGUE_IDS = "103,104"

DIVISION_ORDER = {
    # AL
    "American League East": 0,
    "American League Central": 1,
    "American League West": 2,
    # NL
    "National League East": 3,
    "National League Central": 4,
    "National League West": 5,
}


async def fetch_standings(season: int) -> StandingsResponse:
    """Fetch current standings from the MLB Stats API."""
    async with httpx.AsyncClient(timeout=15.0) as http:
        resp = await http.get(
            f"{MLB_API}/standings",
            params={
                "leagueId": LEAGUE_IDS,
                "season": season,
                "standingsTypes": "regularSeason",
                "hydrate": "team,division,league",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    divisions: list[DivisionStandings] = []
    for record in data.get("records", []):
        div_name = record.get("division", {}).get("name", "Unknown")
        league_name = record.get("league", {}).get("name", "Unknown")

        teams: list[TeamRecord] = []
        for tr in record.get("teamRecords", []):
            team_info = tr.get("team", {})
            streak = tr.get("streak", {})
            split_records = tr.get("records", {}).get("splitRecords", [])
            home_rec = next((s for s in split_records if s["type"] == "home"), {})
            away_rec = next((s for s in split_records if s["type"] == "away"), {})
            last_ten = next(
                (s for s in split_records if s["type"] == "lastTen"), {}
            )

            teams.append(
                TeamRecord(
                    team_id=team_info.get("id", 0),
                    team_name=team_info.get("name", "Unknown"),
                    team_abbrev=team_info.get("abbreviation", "???"),
                    wins=tr.get("wins", 0),
                    losses=tr.get("losses", 0),
                    pct=tr.get("winningPercentage", ".000"),
                    gb=tr.get("gamesBack", "-"),
                    home_record=f"{home_rec.get('wins', 0)}-{home_rec.get('losses', 0)}",
                    away_record=f"{away_rec.get('wins', 0)}-{away_rec.get('losses', 0)}",
                    last_ten=f"{last_ten.get('wins', 0)}-{last_ten.get('losses', 0)}",
                    streak=f"{streak.get('streakCode', '-')}",
                    runs_scored=tr.get("runsScored", 0),
                    runs_allowed=tr.get("runsAllowed", 0),
                    run_diff=tr.get("runDifferential", 0),
                    division_rank=int(tr.get("divisionRank", 0)),
                )
            )

        teams.sort(key=lambda t: t.division_rank)
        divisions.append(
            DivisionStandings(
                division_name=div_name,
                league_name=league_name,
                teams=teams,
            )
        )

    divisions.sort(key=lambda d: DIVISION_ORDER.get(d.division_name, 99))

    return StandingsResponse(season=season, divisions=divisions)
