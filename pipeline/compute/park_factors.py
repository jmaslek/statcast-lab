"""Park factors from home / road runs-per-game, halved for team-side effects."""

from loguru import logger

from pipeline.compute._common import Client, delete_season

_RUNS_QUERY = """
SELECT
    {team_col} AS team,
    count(DISTINCT game_pk) AS games,
    sum(post_bat_score - bat_score) AS runs
FROM pitches
WHERE game_year = {{season:UInt16}}
  AND game_type = 'R'
  AND events IS NOT NULL AND events != 'truncated_pa'
  AND bat_score IS NOT NULL
  AND post_bat_score IS NOT NULL
GROUP BY {team_col}
"""


def _runs_by_team(client: Client, season: int, team_col: str) -> dict[str, tuple[int, int]]:
    rows = client.query(
        _RUNS_QUERY.format(team_col=team_col),
        parameters={"season": season},
    ).result_rows
    return {team: (games, runs) for team, games, runs in rows}


def compute_park_factors(client: Client, season: int) -> int:
    logger.info("Park factors for {}", season)

    home = _runs_by_team(client, season, "home_team")
    road = _runs_by_team(client, season, "away_team")
    if not home:
        logger.warning("No home data for {}", season)
        return 0

    venue_rows = client.query(
        "SELECT abbreviation, venue_name FROM teams FINAL"
    ).result_rows
    venues = dict(venue_rows)

    results = []
    for team in sorted(set(home) & set(road)):
        home_games, home_runs = home[team]
        road_games, road_runs = road[team]
        if not home_games or not road_games:
            continue

        home_rpg = home_runs / home_games
        road_rpg = road_runs / road_games
        if road_rpg == 0:
            continue

        # Half the observed difference — teams play half their games at home,
        # half away, so only half the home/road gap is attributable to the park.
        park_factor = 1 + (home_rpg / road_rpg - 1) / 2

        results.append((
            season, team, venues.get(team, "Unknown"),
            home_games, road_games,
            round(home_rpg, 3), round(road_rpg, 3), round(park_factor, 3),
        ))

    if not results:
        logger.warning("No teams with home/road splits for {}", season)
        return 0

    delete_season(client, "season_park_factors", season)
    client.insert(
        "season_park_factors",
        results,
        column_names=[
            "season", "team", "venue",
            "home_games", "road_games",
            "home_rpg", "road_rpg", "park_factor",
        ],
    )
    logger.info("Wrote park factors for {} teams in {}", len(results), season)
    return len(results)
