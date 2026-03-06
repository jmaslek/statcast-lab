"""Players and teams dimension table ingestion from MLB Stats API."""

import httpx
import polars as pl
from loguru import logger

MLB_STATS_API = "https://statsapi.mlb.com/api/v1"


def fetch_teams() -> pl.DataFrame:
    """Fetch all MLB teams from the Stats API.

    GET /teams?sportId=1
    Returns a Polars DataFrame with columns:
        team_id, team_name, abbreviation, league, division, venue_name
    """
    url = f"{MLB_STATS_API}/teams"
    resp = httpx.get(url, params={"sportId": 1}, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    rows = []
    for team in data.get("teams", []):
        rows.append(
            {
                "team_id": team["id"],
                "team_name": team["name"],
                "abbreviation": team.get("abbreviation", ""),
                "league": team.get("league", {}).get("name", ""),
                "division": team.get("division", {}).get("name", ""),
                "venue_name": team.get("venue", {}).get("name", ""),
            }
        )

    return pl.DataFrame(rows)


def fetch_roster(team_id: int, season: int, team_abbrev: str = "") -> pl.DataFrame:
    """Fetch the 40-man roster for a team/season from the Stats API.

    GET /teams/{team_id}/roster?rosterType=40Man&season={season}
    Returns a Polars DataFrame with columns:
        player_id, name_full, name_first, name_last, position,
        team, bat_side, throw_hand, active, birth_date, debut_date
    """
    url = f"{MLB_STATS_API}/teams/{team_id}/roster"
    resp = httpx.get(
        url,
        params={"rosterType": "40Man", "season": season},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()

    rows = []
    for entry in data.get("roster", []):
        person = entry.get("person", {})
        full_name = person.get("fullName", "")
        parts = full_name.split(" ", 1)
        name_first = parts[0] if parts else ""
        name_last = parts[1] if len(parts) > 1 else ""

        rows.append(
            {
                "player_id": person.get("id"),
                "name_full": full_name,
                "name_first": name_first,
                "name_last": name_last,
                "position": entry.get("position", {}).get("abbreviation", ""),
                "team": team_abbrev,
                "bat_side": entry.get("batSide", {}).get("code", ""),
                "throw_hand": entry.get("pitchHand", {}).get("code", ""),
                "active": 1,
            }
        )

    df = pl.DataFrame(rows)

    # Add birth_date and debut_date as null Date columns
    df = df.with_columns(
        pl.lit(None).cast(pl.Date).alias("birth_date"),
        pl.lit(None).cast(pl.Date).alias("debut_date"),
    )

    return df


def load_teams(client) -> int:
    """Fetch MLB teams and insert into ClickHouse teams table.

    Returns the number of rows inserted.
    """
    logger.info("Fetching MLB teams...")
    df = fetch_teams()
    pdf = df.to_pandas()
    client.insert_df("teams", pdf)
    logger.info("Inserted %d teams", len(df))
    return len(df)


def load_players(client, season: int) -> int:
    """Fetch 40-man rosters for all MLB teams and insert into ClickHouse players table.

    Returns the total number of player rows inserted.
    """
    logger.info("Fetching teams for roster lookup...")
    teams_df = fetch_teams()
    team_ids = teams_df["team_id"].to_list()

    total_rows = 0
    for team_id in team_ids:
        team_row = teams_df.filter(pl.col("team_id") == team_id)
        team_name = team_row["team_name"][0]
        team_abbrev = team_row["abbreviation"][0]
        try:
            logger.info(
                "Fetching roster for %s (%s, season=%d)",
                team_name,
                team_abbrev,
                season,
            )
            roster_df = fetch_roster(team_id, season, team_abbrev)
            row_count = len(roster_df)

            if row_count == 0:
                logger.info("No roster data for %s", team_name)
                continue

            pdf = roster_df.to_pandas()
            client.insert_df("players", pdf)
            logger.info("Inserted %d players for %s", row_count, team_name)
            total_rows += row_count

        except Exception:
            logger.exception(
                "Error fetching roster for %s (team_id=%d)", team_name, team_id
            )

    logger.info("Total player rows loaded: %d", total_rows)
    return total_rows
