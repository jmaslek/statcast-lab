from litestar import Controller, get
from backend.db import Client
from backend.models.war import BattingWarRow, PitchingWarRow, WarLeaderboard


class WarController(Controller):
    path = "/api/war"

    @get("/leaderboard")
    async def leaderboard(
        self,
        client: Client,
        season: int = 2025,
        limit: int = 50,
    ) -> WarLeaderboard:

        bat_result = client.query(
            """
            SELECT
                w.player_id, p.name_full,
                w.pa, w.woba, w.wrc_plus, w.batting_runs, w.war
            FROM player_batting_war AS w FINAL
            JOIN players AS p FINAL ON w.player_id = p.player_id
            WHERE w.season = {season:UInt16}
            ORDER BY w.war DESC
            LIMIT {limit:UInt32}
            """,
            parameters={"season": season, "limit": limit},
        )

        batting = [
            BattingWarRow(
                player_id=pid,
                name=name,
                pa=pa,
                woba=round(woba, 3),
                wrc_plus=round(wrc, 1),
                batting_runs=round(br, 1),
                war=round(war, 1),
            )
            for pid, name, pa, woba, wrc, br, war in bat_result.result_rows
        ]

        pitch_result = client.query(
            """
            SELECT
                w.player_id, p.name_full,
                w.ip, w.ra9, w.ra9_war, w.re24, w.re24_war
            FROM player_pitching_war AS w FINAL
            JOIN players AS p FINAL ON w.player_id = p.player_id
            WHERE w.season = {season:UInt16}
            ORDER BY w.ra9_war DESC
            LIMIT {limit:UInt32}
            """,
            parameters={"season": season, "limit": limit},
        )

        pitching = [
            PitchingWarRow(
                player_id=pid,
                name=name,
                ip=round(ip, 1),
                ra9=round(ra9, 2),
                ra9_war=round(ra9w, 1),
                re24=round(re24, 1),
                re24_war=round(re24w, 1),
            )
            for pid, name, ip, ra9, ra9w, re24, re24w in pitch_result.result_rows
        ]

        return WarLeaderboard(batting=batting, pitching=pitching, season=season)
