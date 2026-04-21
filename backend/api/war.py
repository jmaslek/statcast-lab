from litestar import Controller, get
from backend.db import Client
from backend.models.war import BattingWarRow, PitchingWarRow, WarLeaderboard
from backend.utils import sort_and_limit

_BAT_WAR_SORT_COLS = {"war", "batting_runs", "wrc_plus", "woba", "pa"}
_PITCH_WAR_SORT_COLS = {"ra9_war", "re24_war", "re24", "ra9", "ip"}


class WarController(Controller):
    path = "/api/war"

    @get("/leaderboard")
    async def leaderboard(
        self,
        client: Client,
        season: int = 2025,
        sort: str = "war",
        limit: int = 50,
        desc: bool = True,
        offset: int = 0,
    ) -> WarLeaderboard:

        bat_result = client.query(
            """
            SELECT
                w.player_id, p.name_full,
                w.pa, w.woba, w.wrc_plus, w.batting_runs, w.war
            FROM player_batting_war AS w FINAL
            JOIN players AS p FINAL ON w.player_id = p.player_id
            WHERE w.season = {season:UInt16}
            """,
            parameters={"season": season},
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
            """,
            parameters={"season": season},
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

        # Sort batting and pitching separately, default to WAR if sort field doesn't apply
        batting, batting_total = sort_and_limit(
            batting, sort if sort in _BAT_WAR_SORT_COLS else "war",
            _BAT_WAR_SORT_COLS | {"war"}, desc, limit, offset=offset,
        )
        pitching, pitching_total = sort_and_limit(
            pitching, sort if sort in _PITCH_WAR_SORT_COLS else "ra9_war",
            _PITCH_WAR_SORT_COLS | {"ra9_war"}, desc, limit, offset=offset,
        )

        return WarLeaderboard(
            batting=batting,
            pitching=pitching,
            season=season,
            batting_total=batting_total,
            pitching_total=pitching_total,
        )
