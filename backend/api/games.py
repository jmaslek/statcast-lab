from datetime import date as date_type
from litestar import Controller, get
from backend.db import Client
from backend.models.games import (
    BoxscoreResponse,
    GameDetail,
    GameListResponse,
    GameSummary,
    PitchDetail,
    WpaData,
    WpaPlay,
)
from backend.services.boxscore import fetch_boxscore


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
                game_pk=game_pk,
                game_date=gd,
                home_team=home,
                away_team=away,
                home_score=hs,
                away_score=aws,
            )
            for game_pk, gd, home, away, hs, aws in result.result_rows
        ]

        return GameListResponse(games=games, date=game_date)

    @get("/{game_pk:int}")
    async def get_game(self, client: Client, game_pk: int) -> GameDetail:
        """Get full pitch-by-pitch data for a game."""

        result = client.query(
            """
            SELECT
                p.at_bat_number, p.pitch_number, p.inning, p.inning_topbot,
                p.pitcher, pit.name_full AS pitcher_name,
                p.batter, bat.name_full AS batter_name,
                p.pitch_type, p.release_speed,
                p.description, p.events, p.plate_x, p.plate_z,
                p.launch_speed, p.launch_angle, p.home_win_exp,
                p.game_date, p.home_team, p.away_team
            FROM pitches AS p
            LEFT JOIN players AS pit FINAL ON p.pitcher = pit.player_id
            LEFT JOIN players AS bat FINAL ON p.batter = bat.player_id
            WHERE p.game_pk = {gpk:UInt32}
            ORDER BY p.at_bat_number, p.pitch_number
            """,
            parameters={"gpk": game_pk},
        )

        pitches = []
        game_date = None
        home_team = ""
        away_team = ""

        for (
            ab_num, p_num, inning, topbot,
            pitcher_id, pitcher_name,
            batter_id, batter_name,
            pitch_type, velo,
            desc, events,
            px, pz, ev, la, hwe,
            gd, ht, at,
        ) in result.result_rows:
            if game_date is None:
                game_date = gd
                home_team = ht
                away_team = at

            pitches.append(PitchDetail(
                at_bat_number=ab_num,
                pitch_number=p_num,
                inning=inning,
                inning_topbot=topbot,
                pitcher=pitcher_id,
                pitcher_name=pitcher_name or "Unknown",
                batter=batter_id,
                batter_name=batter_name or "Unknown",
                pitch_type=pitch_type,
                release_speed=velo,
                description=desc,
                events=events,
                plate_x=px,
                plate_z=pz,
                launch_speed=ev,
                launch_angle=la,
                home_win_exp=hwe,
            ))

        return GameDetail(
            game_pk=game_pk,
            game_date=game_date,
            home_team=home_team,
            away_team=away_team,
            pitches=pitches,
            total_pitches=len(pitches),
        )

    @get("/{game_pk:int}/boxscore")
    async def get_boxscore(self, game_pk: int) -> BoxscoreResponse:
        """Get boxscore from MLB Stats API."""
        return await fetch_boxscore(game_pk)

    @get("/{game_pk:int}/wpa")
    async def get_wpa(self, client: Client, game_pk: int) -> WpaData:
        """Get win probability added data for a game."""
        result = client.query(
            """
            SELECT
                p.at_bat_number,
                p.inning,
                p.inning_topbot,
                bat.name_full AS batter_name,
                pit.name_full AS pitcher_name,
                p.events,
                p.home_win_exp,
                p.delta_home_win_exp,
                p.home_team,
                p.away_team
            FROM pitches AS p
            LEFT JOIN players AS bat FINAL ON p.batter = bat.player_id
            LEFT JOIN players AS pit FINAL ON p.pitcher = pit.player_id
            WHERE p.game_pk = {gpk:UInt32}
              AND p.events IS NOT NULL
            ORDER BY p.at_bat_number, p.pitch_number
            """,
            parameters={"gpk": game_pk},
        )

        plays = []
        home_team = ""
        away_team = ""
        for (
            at_bat_number, inning, inning_topbot,
            batter_name, pitcher_name,
            events, home_win_exp, delta_home_win_exp,
            ht, at,
        ) in result.result_rows:
            if not home_team:
                home_team = ht
                away_team = at
            plays.append(WpaPlay(
                at_bat_number=at_bat_number,
                inning=inning,
                inning_topbot=inning_topbot,
                batter_name=batter_name or "Unknown",
                pitcher_name=pitcher_name or "Unknown",
                events=events,
                home_win_exp=round(home_win_exp, 4) if home_win_exp is not None else None,
                delta_home_win_exp=round(delta_home_win_exp, 4) if delta_home_win_exp is not None else None,
            ))

        return WpaData(
            game_pk=game_pk,
            home_team=home_team,
            away_team=away_team,
            plays=plays,
        )
