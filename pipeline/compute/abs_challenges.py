"""ABS challenge events from MLB Stats API play-by-play.

Scans every game's playEvents for reviewDetails with reviewType "MJ" (ABS
pitch challenge). This is the full-season source; the Savant vizChallenges
scrape only exposes the last ~week and is used only as a fallback.
"""

import time

import httpx
from loguru import logger

MLB_API = "https://statsapi.mlb.com/api/v1"
ZONE_HALF_WIDTH = 0.83  # feet, standard 17" plate + baseball width


def _fetch_play_by_play(game_pk: int) -> dict | None:
    for attempt in range(3):
        try:
            resp = httpx.get(f"{MLB_API}/game/{game_pk}/playByPlay", timeout=30)
            resp.raise_for_status()
            return resp.json()
        except Exception:
            if attempt == 2:
                logger.warning("Failed to fetch play-by-play for game {}", game_pk)
                return None
            time.sleep(1)
    return None


def _edge_dist(px: float, pz: float, sz_top: float, sz_bot: float) -> float:
    dx = max(0.0, abs(px) - ZONE_HALF_WIDTH)
    dz = max(0.0, pz - sz_top) if pz > sz_top else max(0.0, sz_bot - pz)
    if abs(px) <= ZONE_HALF_WIDTH and sz_bot <= pz <= sz_top:
        dx_in = ZONE_HALF_WIDTH - abs(px)
        dz_in = min(pz - sz_bot, sz_top - pz)
        return -min(dx_in, dz_in)
    return max(dx, dz)


def _extract_challenges(pbp: dict, game_pk: int, game_date, season: int,
                        home_team: str, away_team: str,
                        player_names: dict, catcher_map: dict) -> list[dict]:
    rows = []

    for play in pbp.get("allPlays", []):
        about = play.get("about", {})
        matchup = play.get("matchup", {})
        ab_index = about.get("atBatIndex", 0)
        inning = about.get("inning", 0)
        half_inning = about.get("halfInning", "top")
        is_top = half_inning == "top"

        batter_id = matchup.get("batter", {}).get("id", 0)
        batter_name_api = matchup.get("batter", {}).get("fullName", "")
        pitcher_id = matchup.get("pitcher", {}).get("id", 0)
        pitcher_name_api = matchup.get("pitcher", {}).get("fullName", "")

        bat_team = away_team if is_top else home_team
        fld_team = home_team if is_top else away_team

        for event in play.get("playEvents", []):
            review = event.get("reviewDetails")
            if not review:
                continue

            # reviewType "MJ" = ABS pitch challenge
            if review.get("reviewType") != "MJ":
                continue

            overturned = review.get("isOverturned", False)

            pitch_data = event.get("pitchData", {})
            coords = pitch_data.get("coordinates", {})
            px = coords.get("pX") or 0.0
            pz = coords.get("pZ") or 0.0
            sz_top = pitch_data.get("strikeZoneTop") or 3.5
            sz_bot = pitch_data.get("strikeZoneBottom") or 1.5

            count = event.get("count", {})
            details = event.get("details", {})
            # The count we see is post-pitch; back out the pre-challenge count.
            pre_balls = max(0, count.get("balls", 0) - int(details.get("isBall", False)))
            pre_strikes = max(0, count.get("strikes", 0) - int(details.get("isStrike", False)))
            outs_val = count.get("outs", 0)

            original_is_strike = 1 if details.get("description", "") == "Called Strike" else 0

            # Who challenged? First try review.player; fall back to a heuristic
            # on the original call (batters typically challenge strikes, catchers
            # typically challenge balls).
            challenger = review.get("player", {})
            challenger_id = challenger.get("id", 0)
            if challenger_id == batter_id:
                is_batter_chal, is_catcher_chal = 1, 0
            elif challenger_id:
                is_batter_chal, is_catcher_chal = 0, 1
            elif original_is_strike:
                is_batter_chal, is_catcher_chal = 1, 0
            else:
                is_batter_chal, is_catcher_chal = 0, 1

            batter_name = player_names.get(batter_id, batter_name_api)
            pitcher_name = player_names.get(pitcher_id, pitcher_name_api)
            catcher_id = catcher_map.get((game_pk, ab_index), 0)
            catcher_name = player_names.get(catcher_id, "")
            if is_catcher_chal and challenger_id and not catcher_name:
                catcher_name = player_names.get(challenger_id, challenger.get("fullName", ""))

            edge_dist = _edge_dist(px, pz, sz_top, sz_bot)

            is_strike3_added = is_strike3_removed = is_ball4_added = is_ball4_removed = 0
            if overturned:
                if not original_is_strike and count.get("strikes", 0) >= 3:
                    is_strike3_added = 1
                elif original_is_strike:
                    if count.get("balls", 0) >= 4:
                        is_ball4_added = 1
                    if pre_strikes >= 2:
                        is_strike3_removed = 1

            rows.append({
                "season": season,
                "game_pk": game_pk,
                "play_id": f"{game_pk}_{ab_index}_{event.get('index', 0)}",
                "game_date": game_date,
                "event_inning": inning,
                "outs": outs_val,
                "pre_ball_count": pre_balls,
                "pre_strike_count": pre_strikes,
                "batter_name": batter_name,
                "pitcher_name": pitcher_name,
                "catcher_name": catcher_name,
                "bat_team_abbr": bat_team,
                "fld_team_abbr": fld_team,
                "plate_x": round(px, 6),
                "plate_z": round(pz, 6),
                "sz_top": round(sz_top, 3),
                "sz_bot": round(sz_bot, 3),
                "original_is_strike": original_is_strike,
                "is_overturned": 1 if overturned else 0,
                "is_batter_challenge": is_batter_chal,
                "is_catcher_challenge": is_catcher_chal,
                "is_pitcher_challenge": 0,
                "edge_dist": round(edge_dist, 4),
                "chal_gained": 0.0,
                "chal_lost": 0.0,
                "is_strike3_added": is_strike3_added,
                "is_strike3_removed": is_strike3_removed,
                "is_ball4_added": is_ball4_added,
                "is_ball4_removed": is_ball4_removed,
            })

    return rows


def compute_abs_challenges(client, season: int) -> int:
    """Rebuild abs_challenge_events for a season from the MLB Stats API."""
    import pandas as pd

    logger.info("ABS challenge events for {}", season)

    games = client.query(
        """
        SELECT DISTINCT game_pk, game_date, home_team, away_team
        FROM game_plays
        WHERE season = {season:UInt16}
        ORDER BY game_date, game_pk
        """,
        parameters={"season": season},
    ).result_rows
    if not games:
        return 0
    logger.info("Scanning {} games", len(games))

    player_names = dict(
        client.query("SELECT player_id, name_full FROM players FINAL").result_rows
    )

    # Catcher per PA, picked as the fielder_2 on the last pitch of the at-bat.
    catcher_rows = client.query(
        """
        SELECT game_pk, at_bat_number, argMax(fielder_2, pitch_number) AS catcher_id
        FROM pitches
        WHERE game_year = {season:UInt16}
        GROUP BY game_pk, at_bat_number
        """,
        parameters={"season": season},
    ).result_rows
    catcher_map = {(gpk, abn): cid for gpk, abn, cid in catcher_rows}

    all_rows = []
    for i, (game_pk, game_date, home_team, away_team) in enumerate(games, start=1):
        if i % 50 == 0:
            logger.info("Fetched {}/{} games ({} events)", i, len(games), len(all_rows))
        pbp = _fetch_play_by_play(game_pk)
        if not pbp:
            continue
        all_rows.extend(_extract_challenges(
            pbp, game_pk, game_date, season,
            home_team, away_team, player_names, catcher_map,
        ))
        if i % 20 == 0:
            time.sleep(0.5)

    if not all_rows:
        logger.warning("No challenge events found")
        return 0

    client.command(
        "DELETE FROM abs_challenge_events WHERE season = {season:UInt16}",
        parameters={"season": season},
    )
    client.insert_df("abs_challenge_events", pd.DataFrame(all_rows))
    logger.info("Wrote {} ABS challenge events for {}", len(all_rows), season)
    return len(all_rows)
