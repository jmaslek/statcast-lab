"""Teams and 40-man rosters via the MLB Stats API."""

import httpx
import polars as pl
from loguru import logger

MLB_STATS_API = "https://statsapi.mlb.com/api/v1"


def fetch_teams() -> pl.DataFrame:
    resp = httpx.get(
        f"{MLB_STATS_API}/teams", params={"sportId": 1}, timeout=30,
    )
    resp.raise_for_status()

    rows = [
        {
            "team_id": t["id"],
            "team_name": t["name"],
            "abbreviation": t.get("abbreviation", ""),
            "league": t.get("league", {}).get("name", ""),
            "division": t.get("division", {}).get("name", ""),
            "venue_name": t.get("venue", {}).get("name", ""),
        }
        for t in resp.json().get("teams", [])
    ]
    return pl.DataFrame(rows)


def fetch_roster(team_id: int, season: int, team_abbrev: str = "") -> pl.DataFrame:
    resp = httpx.get(
        f"{MLB_STATS_API}/teams/{team_id}/roster",
        params={"rosterType": "40Man", "season": season, "hydrate": "person"},
        timeout=30,
    )
    resp.raise_for_status()

    rows = []
    for entry in resp.json().get("roster", []):
        person = entry.get("person", {})
        full = person.get("fullName", "")
        first, _, last = full.partition(" ")
        rows.append({
            "player_id": person.get("id"),
            "name_full": full,
            "name_first": first,
            "name_last": last,
            "position": entry.get("position", {}).get("abbreviation", ""),
            "team": team_abbrev,
            "bat_side": entry.get("batSide", {}).get("code", ""),
            "throw_hand": entry.get("pitchHand", {}).get("code", ""),
            "active": 1,
            "birth_date": person.get("birthDate"),
            "debut_date": person.get("mlbDebutDate"),
        })

    return pl.DataFrame(rows).with_columns(
        pl.col("birth_date").str.to_date("%Y-%m-%d", strict=False),
        pl.col("debut_date").str.to_date("%Y-%m-%d", strict=False),
    )


def load_teams(client) -> int:
    df = fetch_teams()
    client.insert_df("teams", df.to_pandas())
    logger.info("Inserted {} teams", len(df))
    return len(df)


def load_players(client, season: int) -> int:
    teams_df = fetch_teams()
    total = 0
    for row in teams_df.iter_rows(named=True):
        team_id, team_name, abbrev = row["team_id"], row["team_name"], row["abbreviation"]
        try:
            logger.info("Roster: {} ({}) season={}", team_name, abbrev, season)
            roster = fetch_roster(team_id, season, abbrev)
            if not len(roster):
                continue
            client.insert_df("players", roster.to_pandas())
            total += len(roster)
        except Exception:
            logger.exception("Roster fetch failed for {} ({})", team_name, team_id)

    logger.info("Total player rows loaded: {}", total)
    return total
