"""ABS (Automated Ball-Strike) leaderboards and recent events from Baseball Savant.

The CSV leaderboard has the full season of aggregates. The vizChallenges JSON
only carries ~1 recent week of individual events — it's kept as a fallback;
the authoritative source for historical events is pipeline.compute.abs_challenges.
"""

import io
import json
import re
from datetime import datetime

import polars as pl
import requests
from loguru import logger

CHALLENGE_TYPES = ["batter", "pitcher", "catcher", "batting-team"]

SAVANT_URL = (
    "https://baseballsavant.mlb.com/leaderboard/abs-challenges"
    "?challengeType={challenge_type}&level=mlb&gameType=regular"
    "&year={year}&csv=True"
)

COLUMN_MAP = {
    "entity_name": "entity_name",
    "team_abbr": "team_abbr",
    "total_vs_expected": "total_vs_expected",
    "net_for": "net_for",
    "net_against": "net_against",
    "n_challenges": "n_challenges",
    "n_overturns": "n_overturns",
    "n_confirms": "n_confirms",
    "rate_overturns": "rate_overturns",
    "n_strikeouts_flip": "n_strikeouts_flip",
    "n_walks_flip": "n_walks_flip",
    "n_challenges_against": "n_challenges_against",
    "n_overturns_against": "n_overturns_against",
    "rate_overturns_against": "rate_overturns_against",
    "n_strikeouts_flip_against": "n_strikeouts_flip_against",
    "n_walks_flip_against": "n_walks_flip_against",
}


_INT_COLS = [
    "n_challenges", "n_overturns", "n_confirms",
    "n_strikeouts_flip", "n_walks_flip",
    "n_challenges_against", "n_overturns_against",
    "n_strikeouts_flip_against", "n_walks_flip_against",
]
_FLOAT_COLS = ["total_vs_expected", "net_for", "net_against", "rate_overturns"]


def fetch_abs_data(season: int, challenge_type: str) -> pl.DataFrame:
    import pandas as pd

    url = SAVANT_URL.format(challenge_type=challenge_type, year=season)
    logger.info("Fetching ABS {} {}", challenge_type, season)

    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    if len(resp.content) < 50:
        logger.info("No ABS data for {} {}", challenge_type, season)
        return pl.DataFrame()

    df = pl.from_pandas(pd.read_csv(io.StringIO(resp.content.decode("utf-8"))))
    df = df.select([c for c in COLUMN_MAP if c in df.columns]).with_columns(
        pl.lit(season).cast(pl.UInt16).alias("season"),
        pl.lit(challenge_type).alias("challenge_type"),
    )

    for col in _INT_COLS:
        if col in df.columns:
            df = df.with_columns(pl.col(col).fill_null(0).cast(pl.UInt32))
    for col in _FLOAT_COLS:
        if col in df.columns:
            df = df.with_columns(pl.col(col).fill_null(0.0).cast(pl.Float64))

    return df


_OUT_COLS = [
    "season", "challenge_type", "entity_name", "team_abbr",
    "total_vs_expected", "net_for", "net_against",
    "n_challenges", "n_overturns", "n_confirms", "rate_overturns",
    "n_strikeouts_flip", "n_walks_flip",
    "n_challenges_against", "n_overturns_against", "rate_overturns_against",
    "n_strikeouts_flip_against", "n_walks_flip_against",
]


def load_abs(client, season: int) -> int:
    client.command(
        "DELETE FROM abs_challenges WHERE season = {season:UInt16}",
        parameters={"season": season},
    )

    total = 0
    for ct in CHALLENGE_TYPES:
        try:
            df = fetch_abs_data(season, ct)
            if df.is_empty():
                continue
            final = df.select(_OUT_COLS)
            client.insert_df("abs_challenges", final.to_pandas())
            total += len(final)
            logger.info("Inserted {} ABS rows for {} {}", len(final), ct, season)
        except Exception:
            logger.exception("ABS fetch failed for {} {}", ct, season)

    logger.info("Total ABS leaderboard rows loaded for {}: {}", season, total)

    events = load_abs_events(client, season)
    logger.info("ABS event rows loaded for {}: {}", season, events)
    return total


def load_abs_events(client, season: int) -> int:
    """Scrape the vizChallenges blob on /abs. Recent events only (~1 week)."""
    logger.info("Fetching ABS challenge events for {}", season)

    resp = requests.get(
        f"https://baseballsavant.mlb.com/abs?year={season}", timeout=30,
    )
    resp.raise_for_status()

    match = re.search(r"vizChallenges\s*=\s*(\[[\s\S]*?\]);", resp.text)
    if not match:
        logger.warning("vizChallenges blob missing on /abs")
        return 0

    events = json.loads(match.group(1))
    if not events:
        return 0

    logger.info("Parsed {} challenge events", len(events))

    rows = []
    for ev in events:
        game_date_str = (ev.get("game_date") or "")[:10]
        try:
            game_date = datetime.strptime(game_date_str, "%Y-%m-%d").date()
        except ValueError:
            continue

        rows.append({
            "season": season,
            "game_pk": ev.get("game_pk", 0),
            "play_id": ev.get("play_id", ""),
            "game_date": game_date,
            "event_inning": ev.get("event_inning", 0),
            "outs": ev.get("outs", 0),
            "pre_ball_count": ev.get("pre_ball_count", 0),
            "pre_strike_count": ev.get("pre_strike_count", 0),
            "batter_name": ev.get("batter_name_flipped", "") or ev.get("batter_name", ""),
            "pitcher_name": ev.get("pitcher_name_flipped", "") or ev.get("pitcher_name", ""),
            "catcher_name": ev.get("catcher_name_flipped", "") or ev.get("catcher_name", ""),
            "bat_team_abbr": ev.get("bat_team_abbr", ""),
            "fld_team_abbr": ev.get("fld_team_abbr", ""),
            "plate_x": ev.get("plateX", 0.0),
            "plate_z": ev.get("plateZ", 0.0),
            "sz_top": ev.get("strikeZoneTop", 3.5),
            "sz_bot": ev.get("strikeZoneBottom", 1.5),
            "original_is_strike": ev.get("original_isStrike_ump", 0),
            "is_overturned": ev.get("is_challengeABS_overturned", 0),
            "is_strike3_added": ev.get("is_strike3_added", 0),
            "is_strike3_removed": ev.get("is_strike3_removed", 0),
            "is_ball4_added": ev.get("is_ball4_added", 0),
            "is_ball4_removed": ev.get("is_ball4_removed", 0),
            "is_batter_challenge": ev.get("is_batter_challenge", 0),
            "is_catcher_challenge": ev.get("is_catcher_challenge", 0),
            "is_pitcher_challenge": ev.get("is_pitcher_challenge", 0),
            "edge_dist": ev.get("edge_dist_calc", 0.0),
            "chal_gained": ev.get("chal_gained", 0.0),
            "chal_lost": ev.get("chal_lost", 0.0),
        })

    if not rows:
        return 0

    import pandas as pd

    pdf = pd.DataFrame(rows)

    client.command(
        "DELETE FROM abs_challenge_events WHERE season = {season:UInt16}",
        parameters={"season": season},
    )
    client.insert_df("abs_challenge_events", pdf)
    logger.info("Inserted {} ABS challenge events for {}", len(rows), season)
    return len(rows)
