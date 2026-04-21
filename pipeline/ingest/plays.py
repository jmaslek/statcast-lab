"""Play-by-play + runner events from the MLB Stats API.

Powers baserunning analytics (stolen bases, pickoffs, WP/PB advances, etc.).
"""

import time
from datetime import date

import httpx
import polars as pl
from loguru import logger

MLB_API = "https://statsapi.mlb.com/api/v1"


def fetch_schedule(start_date: date, end_date: date) -> list[dict]:
    """Completed regular-season games. Keys: game_pk, game_date, home_team, away_team."""
    resp = httpx.get(
        f"{MLB_API}/schedule",
        params={
            "sportId": 1,
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
            "gameType": "R",
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()

    games = []
    for day in data.get("dates", []):
        game_date = date.fromisoformat(day["date"])
        for g in day.get("games", []):
            status = g.get("status", {}).get("statusCode", "")
            if status != "F":
                continue
            away_team = g["teams"]["away"]["team"]
            home_team = g["teams"]["home"]["team"]
            games.append(
                {
                    "game_pk": g["gamePk"],
                    "game_date": game_date,
                    "away_team": away_team.get("abbreviation", "")
                    or away_team.get("name", "???"),
                    "home_team": home_team.get("abbreviation", "")
                    or home_team.get("name", "???"),
                }
            )

    return games


def _resolve_team_abbreviations(client, games: list[dict]) -> list[dict]:
    # The schedule endpoint sometimes gives full team names instead of 2-3
    # letter abbreviations (len > 4 is the tell). Fall back to the teams
    # table for the mapping in that case.
    if not any(len(g["home_team"]) > 4 or len(g["away_team"]) > 4 for g in games):
        return games

    name_to_abbr = dict(
        client.query("SELECT team_name, abbreviation FROM teams").result_rows
    )
    for g in games:
        if len(g["home_team"]) > 4:
            g["home_team"] = name_to_abbr.get(g["home_team"], g["home_team"])
        if len(g["away_team"]) > 4:
            g["away_team"] = name_to_abbr.get(g["away_team"], g["away_team"])
    return games


def fetch_play_by_play(game_pk: int) -> dict:
    resp = httpx.get(f"{MLB_API}/game/{game_pk}/playByPlay", timeout=30)
    resp.raise_for_status()
    return resp.json()


def parse_game(
    pbp: dict,
    game_pk: int,
    game_date: date,
    season: int,
    home_team: str,
    away_team: str,
) -> tuple[list[dict], list[dict]]:
    plays = []
    runners = []

    for play in pbp.get("allPlays", []):
        about = play.get("about", {})
        result = play.get("result", {})
        count = play.get("count", {})
        matchup = play.get("matchup", {})

        at_bat_index = about.get("atBatIndex", 0)
        inning = about.get("inning", 0)
        half_inning = about.get("halfInning", "top")

        batter = matchup.get("batter", {})
        pitcher = matchup.get("pitcher", {})
        batter_id = batter.get("id", 0)
        pitcher_id = pitcher.get("id", 0)

        plays.append(
            {
                "game_pk": game_pk,
                "game_date": game_date,
                "season": season,
                "at_bat_index": at_bat_index,
                "inning": inning,
                "half_inning": half_inning,
                "batter_id": batter_id,
                "pitcher_id": pitcher_id,
                "bat_side": matchup.get("batSide", {}).get("code", ""),
                "pitch_hand": matchup.get("pitchHand", {}).get("code", ""),
                "result_type": result.get("type", ""),
                "event": result.get("event"),
                "event_type": result.get("eventType"),
                "description": result.get("description", ""),
                "rbi": result.get("rbi", 0),
                "away_score": result.get("awayScore", 0),
                "home_score": result.get("homeScore", 0),
                "is_out": int(bool(result.get("isOut"))),
                "balls": count.get("balls", 0),
                "strikes": count.get("strikes", 0),
                "outs": count.get("outs", 0),
                "is_scoring_play": int(about.get("isScoringPlay", False)),
                "is_complete": int(about.get("isComplete", False)),
                "home_team": home_team,
                "away_team": away_team,
            }
        )

        for runner_entry in play.get("runners", []):
            movement = runner_entry.get("movement", {})
            details = runner_entry.get("details", {})
            runner = details.get("runner", {})
            resp_pitcher = details.get("responsiblePitcher") or {}

            runners.append(
                {
                    "game_pk": game_pk,
                    "game_date": game_date,
                    "season": season,
                    "at_bat_index": at_bat_index,
                    "play_event_index": details.get("playIndex", 0),
                    "runner_id": runner.get("id", 0),
                    "origin_base": movement.get("originBase"),
                    "start_base": movement.get("start"),
                    "end_base": movement.get("end"),
                    "is_out": int(bool(movement.get("isOut"))),
                    "out_base": movement.get("outBase"),
                    "out_number": movement.get("outNumber"),
                    "event": details.get("event"),
                    "event_type": details.get("eventType"),
                    "movement_reason": details.get("movementReason"),
                    "is_scoring_event": int(bool(details.get("isScoringEvent"))),
                    "rbi": int(bool(details.get("rbi"))),
                    "earned": int(bool(details.get("earned"))),
                    "team_unearned": int(bool(details.get("teamUnearned"))),
                    "responsible_pitcher_id": resp_pitcher.get("id"),
                    "inning": inning,
                    "half_inning": half_inning,
                    "batter_id": batter_id,
                    "pitcher_id": pitcher_id,
                }
            )

    return plays, runners


def _insert_batch(client, plays: list[dict], runners: list[dict]) -> tuple[int, int]:
    def _write(table: str, rows: list[dict]) -> int:
        if not rows:
            return 0
        df = pl.DataFrame(rows).with_columns(pl.col("game_date").cast(pl.Date))
        client.insert_df(table, df.to_pandas())
        return len(df)

    return _write("game_plays", plays), _write("play_runners", runners)


def load_plays(
    client,
    start_date: date,
    end_date: date,
    batch_size: int = 25,
    delay: float = 0.15,
) -> tuple[int, int]:
    """Load play-by-play for [start_date, end_date]. Skips games already loaded."""
    logger.info("Fetching schedule: {} to {}", start_date, end_date)
    games = _resolve_team_abbreviations(client, fetch_schedule(start_date, end_date))
    logger.info("Found {} final games", len(games))

    if not games:
        return 0, 0

    existing = {
        gpk
        for (gpk,) in client.query(
            """
            SELECT DISTINCT game_pk FROM game_plays
            WHERE game_date BETWEEN {start:Date} AND {end:Date}
            """,
            parameters={"start": start_date, "end": end_date},
        ).result_rows
    }
    new_games = [g for g in games if g["game_pk"] not in existing]
    logger.info(
        "Skipping {} already-loaded, {} to fetch",
        len(games) - len(new_games), len(new_games),
    )

    total_plays = 0
    total_runners = 0
    batch_plays: list[dict] = []
    batch_runners: list[dict] = []
    games_in_batch = 0

    for i, game in enumerate(new_games):
        game_pk = game["game_pk"]
        game_date = game["game_date"]
        season = game_date.year

        try:
            pbp = fetch_play_by_play(game_pk)
            plays, runners = parse_game(
                pbp, game_pk, game_date, season,
                game["home_team"], game["away_team"],
            )
            batch_plays.extend(plays)
            batch_runners.extend(runners)
            games_in_batch += 1

        except Exception:
            logger.exception("Error fetching game {}", game_pk)
            continue

        # Flush batch
        if games_in_batch >= batch_size or i == len(new_games) - 1:
            pc, rc = _insert_batch(client, batch_plays, batch_runners)
            total_plays += pc
            total_runners += rc
            logger.info(
                "Batch insert: {} plays, {} runners ({}/{} games done)",
                pc, rc, i + 1, len(new_games),
            )
            batch_plays = []
            batch_runners = []
            games_in_batch = 0

        if delay > 0 and i < len(new_games) - 1:
            time.sleep(delay)

    logger.info(
        "Play-by-play load complete: {} plays, {} runner events",
        total_plays,
        total_runners,
    )
    return total_plays, total_runners
