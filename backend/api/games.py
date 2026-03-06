from datetime import date as date_type
from litestar import Controller, get
from backend.db import Client
from backend.models.games import GameListResponse, GameSummary, GameDetail, PitchDetail


class GameController(Controller):
    path = "/api/games"

    @get("/")
    async def list_games(self, client: Client, date: str = "") -> GameListResponse:
        """List games for a specific date. Date format: YYYY-MM-DD."""

        if not date:
            # Default to most recent date with data
            latest = client.query("SELECT max(game_date) FROM pitches")
            game_date = latest.first_row[0]
        else:
            game_date = date_type.fromisoformat(date)

        result = client.query(
            """
            SELECT
                game_pk,
                game_date,
                home_team,
                away_team,
                maxIf(post_bat_score, inning_topbot = 'Bot') AS home_score,
                maxIf(post_bat_score, inning_topbot = 'Top') AS away_score
            FROM pitches
            WHERE game_date = {d:Date}
            GROUP BY game_pk, game_date, home_team, away_team
            ORDER BY game_pk
            """,
            parameters={"d": game_date},
        )

        games = [
            GameSummary(
                game_pk=r[0],
                game_date=r[1],
                home_team=r[2],
                away_team=r[3],
                home_score=r[4],
                away_score=r[5],
            )
            for r in result.result_rows
        ]

        return GameListResponse(games=games, date=game_date)

    @get("/{game_pk:int}")
    async def get_game(self, client: Client, game_pk: int) -> GameDetail:
        """Get full pitch-by-pitch data for a game."""

        result = client.query(
            """
            SELECT
                at_bat_number, pitch_number, inning, inning_topbot,
                pitcher, batter, pitch_type, release_speed,
                description, events, plate_x, plate_z,
                launch_speed, launch_angle, game_date, home_team, away_team
            FROM pitches
            WHERE game_pk = {gpk:UInt32}
            ORDER BY at_bat_number, pitch_number
            """,
            parameters={"gpk": game_pk},
        )

        pitches = [
            PitchDetail(
                at_bat_number=r[0],
                pitch_number=r[1],
                inning=r[2],
                inning_topbot=r[3],
                pitcher=r[4],
                batter=r[5],
                pitch_type=r[6],
                release_speed=r[7],
                description=r[8],
                events=r[9],
                plate_x=r[10],
                plate_z=r[11],
                launch_speed=r[12],
                launch_angle=r[13],
            )
            for r in result.result_rows
        ]

        # Get game metadata from first row
        if result.result_rows:
            game_date = result.result_rows[0][14]
            home_team = result.result_rows[0][15]
            away_team = result.result_rows[0][16]
        else:
            game_date = None
            home_team = ""
            away_team = ""

        return GameDetail(
            game_pk=game_pk,
            game_date=game_date,
            home_team=home_team,
            away_team=away_team,
            pitches=pitches,
            total_pitches=len(pitches),
        )
