from litestar import Controller, get

from backend.db import Client
from backend.models.arsenal import ArsenalData, ArsenalRow, PitcherArsenalData
from backend.models.pitching import PitchingLeaderboard
from backend.services.stats import get_pitching_leaderboard

_ARSENAL_SORT_COLS = {
    "whiff_pct",
    "csw_pct",
    "put_away_pct",
    "avg_velo",
    "max_velo",
    "avg_spin",
    "usage_pct",
    "zone_pct",
    "chase_pct",
    "gb_pct",
    "avg_exit_velo",
    "pitch_count",
}


def _build_arsenal_row(row: tuple, name: str) -> ArsenalRow:
    (
        pitcher_id,
        _name,
        pitch_type,
        pitch_name,
        pitch_count,
        usage_pct,
        avg_velo,
        max_velo,
        avg_spin,
        avg_pfx_x,
        avg_pfx_z,
        whiff_pct,
        csw_pct,
        put_away_pct,
        zone_pct,
        chase_pct,
        avg_exit_velo,
        gb_pct,
    ) = row

    return ArsenalRow(
        pitcher_id=pitcher_id,
        name=name,
        pitch_type=pitch_type,
        pitch_name=pitch_name,
        pitch_count=pitch_count,
        usage_pct=usage_pct,
        avg_velo=avg_velo,
        max_velo=max_velo,
        avg_spin=round(avg_spin),
        avg_pfx_x=avg_pfx_x,
        avg_pfx_z=avg_pfx_z,
        whiff_pct=whiff_pct,
        csw_pct=csw_pct,
        put_away_pct=put_away_pct,
        zone_pct=zone_pct,
        chase_pct=chase_pct,
        avg_exit_velo=avg_exit_velo if avg_exit_velo else None,
        gb_pct=gb_pct,
    )


class PitchingController(Controller):
    path = "/api/pitching"

    @get("/leaderboard")
    async def leaderboard(
        self,
        client: Client,
        season: int = 2025,
        min_pitches: int = 100,
        team: str | None = None,
        sort: str = "k_pct",
        limit: int = 50,
    ) -> PitchingLeaderboard:
        players = get_pitching_leaderboard(
            client, season, min_pitches, team, sort, limit
        )
        return PitchingLeaderboard(players=players, season=season, total=len(players))

    @get("/arsenal")
    async def arsenal_leaderboard(
        self,
        client: Client,
        season: int = 2025,
        sort: str = "whiff_pct",
        limit: int = 100,
    ) -> ArsenalData:
        result = client.query(
            """
            SELECT
                a.pitcher, p.name_full,
                a.pitch_type, a.pitch_name, a.pitch_count, a.usage_pct,
                a.avg_velo, a.max_velo, a.avg_spin, a.avg_pfx_x, a.avg_pfx_z,
                a.whiff_pct, a.csw_pct, a.put_away_pct,
                a.zone_pct, a.chase_pct, a.avg_exit_velo, a.gb_pct
            FROM pitcher_arsenal AS a FINAL
            JOIN players AS p FINAL ON a.pitcher = p.player_id
            WHERE a.season = {season:UInt16}
            ORDER BY a.whiff_pct DESC
            """,
            parameters={"season": season},
        )
        rows = [_build_arsenal_row(r, r[1]) for r in result.result_rows]
        if sort in _ARSENAL_SORT_COLS:
            rows.sort(key=lambda r: getattr(r, sort) or 0, reverse=True)
        rows = rows[:limit]
        return ArsenalData(rows=rows, season=season, total=len(rows))

    @get("/arsenal/{pitcher_id:int}")
    async def pitcher_arsenal(
        self,
        client: Client,
        pitcher_id: int,
        season: int = 2025,
    ) -> PitcherArsenalData:
        player_result = client.query(
            "SELECT name_full FROM players FINAL WHERE player_id = {pid:UInt32}",
            parameters={"pid": pitcher_id},
        )
        name = (
            player_result.result_rows[0][0] if player_result.result_rows else "Unknown"
        )
        result = client.query(
            """
            SELECT
                a.pitcher, '' AS name,
                a.pitch_type, a.pitch_name, a.pitch_count, a.usage_pct,
                a.avg_velo, a.max_velo, a.avg_spin, a.avg_pfx_x, a.avg_pfx_z,
                a.whiff_pct, a.csw_pct, a.put_away_pct,
                a.zone_pct, a.chase_pct, a.avg_exit_velo, a.gb_pct
            FROM pitcher_arsenal AS a FINAL
            WHERE a.pitcher = {pid:UInt32}
              AND a.season = {season:UInt16}
            ORDER BY a.usage_pct DESC
            """,
            parameters={"pid": pitcher_id, "season": season},
        )
        pitches = [_build_arsenal_row(r, name) for r in result.result_rows]
        return PitcherArsenalData(
            pitcher_id=pitcher_id,
            name=name,
            pitches=pitches,
            season=season,
        )
