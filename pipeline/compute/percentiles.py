"""Percentile ranks for batters and pitchers, à la Baseball Savant sliders."""

import pandas as pd
from loguru import logger

from pipeline.compute._common import Client, delete_season

# (stat_name, sql_aggregate, min_col, min_value, higher_is_better)
# For stats where lower is better (K% for batters, BB% for pitchers), we
# reverse the ranking so rank 1 = best.
BATTER_STATS: list[tuple[str, str, str, int, bool]] = [
    (
        "exit_velo",
        "avgIf(launch_speed, launch_speed IS NOT NULL) AS val, "
        "countIf(launch_speed IS NOT NULL) AS denom",
        "denom", 25, True,
    ),
    (
        "max_exit_velo",
        "maxIf(launch_speed, launch_speed IS NOT NULL) AS val, "
        "countIf(launch_speed IS NOT NULL) AS denom",
        "denom", 25, True,
    ),
    (
        "bat_speed",
        "avgIf(bat_speed, bat_speed IS NOT NULL) AS val, "
        "countIf(bat_speed IS NOT NULL) AS denom",
        "denom", 25, True,
    ),
    (
        "barrel_pct",
        "countIf(launch_speed_angle = 6) * 100.0 / countIf(launch_speed IS NOT NULL) AS val, "
        "countIf(launch_speed IS NOT NULL) AS denom",
        "denom", 25, True,
    ),
    (
        "hard_hit_pct",
        "countIf(launch_speed >= 95) * 100.0 / countIf(launch_speed IS NOT NULL) AS val, "
        "countIf(launch_speed IS NOT NULL) AS denom",
        "denom", 25, True,
    ),
    (
        "avg_launch_angle",
        "avgIf(launch_angle, launch_angle IS NOT NULL) AS val, "
        "countIf(launch_angle IS NOT NULL) AS denom",
        "denom", 25, True,
    ),
    (
        "sweet_spot_pct",
        "countIf(launch_angle BETWEEN 8 AND 32) * 100.0 / countIf(launch_angle IS NOT NULL) AS val, "
        "countIf(launch_angle IS NOT NULL) AS denom",
        "denom", 25, True,
    ),
    (
        "swing_length",
        "avgIf(swing_length, swing_length IS NOT NULL) AS val, "
        "countIf(swing_length IS NOT NULL) AS denom",
        "denom", 25, False,  # shorter is better
    ),
    (
        "k_pct",
        "countIf(events IN ('strikeout', 'strikeout_double_play')) * 100.0 / "
        "countIf(events IS NOT NULL AND events != '') AS val, "
        "countIf(events IS NOT NULL AND events != '') AS denom",
        "denom", 50, False,  # lower K% is better
    ),
    (
        "bb_pct",
        "countIf(events = 'walk') * 100.0 / "
        "countIf(events IS NOT NULL AND events != '') AS val, "
        "countIf(events IS NOT NULL AND events != '') AS denom",
        "denom", 50, True,
    ),
    (
        "whiff_pct",
        "countIf(description IN ('swinging_strike', 'swinging_strike_blocked', 'foul_tip')) * 100.0 / "
        "countIf(description IN ('swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', "
        "'hit_into_play', 'hit_into_play_no_out', 'hit_into_play_score')) AS val, "
        "countIf(description IN ('swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', "
        "'hit_into_play', 'hit_into_play_no_out', 'hit_into_play_score')) AS denom",
        "denom", 50, False,  # lower whiff% is better for batters
    ),
]

PITCHER_STATS: list[tuple[str, str, str, int, bool]] = [
    (
        "velocity",
        "avg(release_speed) AS val, count() AS denom",
        "denom", 200, True,
    ),
    (
        "max_velocity",
        "max(release_speed) AS val, count() AS denom",
        "denom", 200, True,
    ),
    (
        "spin_rate",
        "avgIf(release_spin_rate, release_spin_rate IS NOT NULL) AS val, "
        "countIf(release_spin_rate IS NOT NULL) AS denom",
        "denom", 200, True,
    ),
    (
        "extension",
        "avgIf(release_extension, release_extension IS NOT NULL) AS val, "
        "countIf(release_extension IS NOT NULL) AS denom",
        "denom", 200, True,
    ),
    (
        "k_pct",
        "countIf(events IN ('strikeout', 'strikeout_double_play')) * 100.0 / "
        "countIf(events IS NOT NULL AND events != '') AS val, "
        "countIf(events IS NOT NULL AND events != '') AS denom",
        "denom", 30, True,  # higher K% is better for pitchers
    ),
    (
        "bb_pct",
        "countIf(events = 'walk') * 100.0 / "
        "countIf(events IS NOT NULL AND events != '') AS val, "
        "countIf(events IS NOT NULL AND events != '') AS denom",
        "denom", 30, False,  # lower BB% is better for pitchers
    ),
    (
        "whiff_pct",
        "countIf(description IN ('swinging_strike', 'swinging_strike_blocked', 'foul_tip')) * 100.0 / "
        "countIf(description IN ('swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', "
        "'hit_into_play', 'hit_into_play_no_out', 'hit_into_play_score')) AS val, "
        "countIf(description IN ('swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', "
        "'hit_into_play', 'hit_into_play_no_out', 'hit_into_play_score')) AS denom",
        "denom", 100, True,  # higher whiff% is better for pitchers
    ),
    (
        "chase_pct",
        "countIf(NOT (zone BETWEEN 1 AND 9) AND description IN ("
        "'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', "
        "'hit_into_play', 'hit_into_play_no_out', 'hit_into_play_score')) * 100.0 / "
        "countIf(NOT (zone BETWEEN 1 AND 9)) AS val, "
        "countIf(NOT (zone BETWEEN 1 AND 9)) AS denom",
        "denom", 100, True,  # higher chase% is better for pitchers
    ),
    (
        "avg_exit_velo_against",
        "avgIf(launch_speed, launch_speed IS NOT NULL) AS val, "
        "countIf(launch_speed IS NOT NULL) AS denom",
        "denom", 25, False,  # lower exit velo against is better
    ),
]


def _compute_for_group(
    client: Client,
    season: int,
    player_col: str,
    player_type: str,
    stats: list[tuple[str, str, str, int, bool]],
) -> list[dict]:
    all_rows = []

    for stat_name, sql_expr, min_col, min_val, higher_is_better in stats:
        result = client.query(
            f"""
            SELECT {player_col} AS player_id, {sql_expr}
            FROM pitches
            WHERE game_year = {{season:UInt16}}
              AND game_type = 'R'
            GROUP BY {player_col}
            HAVING {min_col} >= {{min_val:UInt32}}
              AND val IS NOT NULL
              AND isFinite(val)
            ORDER BY val
            """,
            parameters={"season": season, "min_val": min_val},
        )
        if not result.result_rows:
            continue

        players = [(r[0], r[1]) for r in result.result_rows]
        if not higher_is_better:
            players.reverse()

        n = len(players)
        for rank_idx, (pid, val) in enumerate(players):
            # Baseball Savant-style 1..99 scale with no ties.
            pct = round(rank_idx / max(n - 1, 1) * 100)
            pct = max(1, min(99, pct))
            all_rows.append({
                "player_id": pid,
                "season": season,
                "player_type": player_type,
                "stat_name": stat_name,
                "stat_value": round(val, 3),
                "percentile": pct,
            })

    return all_rows


def compute_percentiles_for_season(client: Client, season: int) -> int:
    logger.info("Percentiles for {}", season)

    rows = (
        _compute_for_group(client, season, "batter", "batter", BATTER_STATS)
        + _compute_for_group(client, season, "pitcher", "pitcher", PITCHER_STATS)
    )
    if not rows:
        logger.warning("No percentile data for {}", season)
        return 0

    delete_season(client, "player_percentiles", season)
    client.insert_df("player_percentiles", pd.DataFrame(rows))

    logger.info("Wrote {} percentile rows for {}", len(rows), season)
    return len(rows)
