"""Park factors: compare runs scored at home vs on the road per team."""

from loguru import logger

from pipeline.compute._common import Client, delete_season


def compute_park_factors(client: Client, season: int) -> int:
    """Compute park factors for a season. Returns count of teams written."""
    logger.info("Computing park factors for %d...", season)

    # Home splits: runs scored in each team's home games (both teams scoring)
    home_rows = client.query(
        """
        SELECT
            home_team,
            count(DISTINCT game_pk) AS home_games,
            sum(post_bat_score - bat_score) AS home_runs
        FROM pitches
        WHERE game_year = {season:UInt16}
          AND game_type = 'R'
          AND events IS NOT NULL
  AND events != 'truncated_pa'
          AND bat_score IS NOT NULL
          AND post_bat_score IS NOT NULL
        GROUP BY home_team
        """,
        parameters={"season": season},
    ).result_rows

    if not home_rows:
        logger.warning("No home data found for %d", season)
        return 0

    # Road splits: runs scored in each team's away games
    road_rows = client.query(
        """
        SELECT
            away_team,
            count(DISTINCT game_pk) AS road_games,
            sum(post_bat_score - bat_score) AS road_runs
        FROM pitches
        WHERE game_year = {season:UInt16}
          AND game_type = 'R'
          AND events IS NOT NULL
  AND events != 'truncated_pa'
          AND bat_score IS NOT NULL
          AND post_bat_score IS NOT NULL
        GROUP BY away_team
        """,
        parameters={"season": season},
    ).result_rows

    # Team -> venue lookup
    venue_rows = client.query(
        "SELECT abbreviation, venue_name FROM teams FINAL"
    ).result_rows
    venue_map = {r[0]: r[1] for r in venue_rows}

    home_map = {r[0]: (r[1], r[2]) for r in home_rows}
    road_map = {r[0]: (r[1], r[2]) for r in road_rows}

    teams = set(home_map) & set(road_map)
    results: list[tuple] = []

    for team in sorted(teams):
        home_games, home_runs = home_map[team]
        road_games, road_runs = road_map[team]

        if home_games == 0 or road_games == 0:
            continue

        home_rpg = home_runs / home_games
        road_rpg = road_runs / road_games

        if road_rpg == 0:
            continue

        raw_pf = home_rpg / road_rpg
        # Standard halving: the team itself plays in both environments, so
        # only half the home/road difference is attributable to the park.
        # This matches the FanGraphs 1-year park factor methodology.
        park_factor = 1 + (raw_pf - 1) / 2

        venue = venue_map.get(team, "Unknown")

        results.append(
            (
                season,
                team,
                venue,
                home_games,
                road_games,
                round(home_rpg, 3),
                round(road_rpg, 3),
                round(park_factor, 3),
            )
        )

    if not results:
        logger.warning("No teams with valid home/road splits for %d", season)
        return 0

    logger.info("Writing park factors for %d teams...", len(results))
    delete_season(client, "season_park_factors", season)

    client.insert(
        "season_park_factors",
        results,
        column_names=[
            "season",
            "team",
            "venue",
            "home_games",
            "road_games",
            "home_rpg",
            "road_rpg",
            "park_factor",
        ],
    )

    logger.info("Wrote park factors for %d teams in %d", len(results), season)
    return len(results)
