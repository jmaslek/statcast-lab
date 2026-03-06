from litestar import Controller, get

from backend.db import Client
from backend.models.players import (
    PlayerHittingStats,
    PlayerPitchingStats,
    PlayerSearchResult,
    PlayerSeasonStats,
    PlayerSummary,
)
from backend.utils import safe_div, safe_pct


class PlayerController(Controller):
    path = "/api/players"

    @get("/search")
    async def search_players(self, client: Client, q: str = "", limit: int = 20) -> PlayerSearchResult:
        result = client.query(
            "SELECT player_id, name_full, position, team "
            "FROM players "
            "WHERE name_full ILIKE {pattern:String} "
            "LIMIT {limit:UInt32}",
            parameters={"pattern": f"%{q}%", "limit": limit},
        )
        players = [
            PlayerSummary(
                player_id=row[0], name_full=row[1], position=row[2], team=row[3]
            )
            for row in result.result_rows
        ]
        return PlayerSearchResult(results=players, total=len(players))

    @get("/{player_id:int}")
    async def get_player(self, client: Client, player_id: int) -> PlayerSummary:
        result = client.query(
            "SELECT player_id, name_full, position, team "
            "FROM players WHERE player_id = {id:UInt32}",
            parameters={"id": player_id},
        )
        row = result.first_row
        return PlayerSummary(
            player_id=row[0], name_full=row[1], position=row[2], team=row[3]
        )

    @get("/{player_id:int}/stats")
    async def get_player_stats(
        self, client: Client, player_id: int, season: int = 2025
    ) -> PlayerSeasonStats:
        """Get full season stats for a player."""

        hitting_result = client.query(
            """
            SELECT pa, ab, hits, singles, doubles, triples, home_runs,
                   walks, strikeouts, hbp, sac_flies, total_bases,
                   launch_speed_sum, launch_speed_count,
                   launch_angle_sum, launch_angle_count,
                   barrel_count, batted_ball_events, hard_hit_count
            FROM player_season_hitting FINAL
            WHERE batter = {pid:UInt32} AND season = {season:UInt16}
            """,
            parameters={"pid": player_id, "season": season},
        )

        pitching_result = client.query(
            """
            SELECT total_pitches, batters_faced, strikeouts, walks,
                   hits_allowed, home_runs_allowed,
                   release_speed_sum, release_speed_count,
                   spin_rate_sum, spin_rate_count,
                   extension_sum, extension_count,
                   whiffs, called_strikes, swings, zone_pitches
            FROM player_season_pitching FINAL
            WHERE pitcher = {pid:UInt32} AND season = {season:UInt16}
            """,
            parameters={"pid": player_id, "season": season},
        )

        hitting = None
        if hitting_result.result_rows:
            (
                pa,
                ab,
                hits,
                singles,
                doubles,
                triples,
                home_runs,
                walks,
                strikeouts,
                hbp,
                sac_flies,
                total_bases,
                ls_sum,
                ls_count,
                la_sum,
                la_count,
                barrel_count,
                bbe,
                hh_count,
            ) = hitting_result.result_rows[0]

            hitting = PlayerHittingStats(
                pa=pa,
                ab=ab,
                hits=hits,
                singles=singles,
                doubles=doubles,
                triples=triples,
                home_runs=home_runs,
                walks=walks,
                strikeouts=strikeouts,
                hbp=hbp,
                sac_flies=sac_flies,
                total_bases=total_bases,
                avg=round(safe_div(hits, ab), 3),
                obp=round(
                    safe_div(hits + walks + hbp, ab + walks + hbp + sac_flies), 3
                ),
                slg=round(safe_div(total_bases, ab), 3),
                avg_exit_velo=round(safe_div(ls_sum, ls_count), 1)
                if ls_count
                else None,
                avg_launch_angle=round(safe_div(la_sum, la_count), 1)
                if la_count
                else None,
                barrel_pct=safe_pct(barrel_count, bbe),
                hard_hit_pct=safe_pct(hh_count, bbe),
            )

        pitching = None
        if pitching_result.result_rows:
            (
                total_pitches,
                bf,
                k,
                bb,
                hits_allowed,
                hr_allowed,
                rs_sum,
                rs_count,
                sr_sum,
                sr_count,
                ext_sum,
                ext_count,
                whiffs,
                called_strikes,
                swings,
                _zone,
            ) = pitching_result.result_rows[0]

            pitching = PlayerPitchingStats(
                total_pitches=total_pitches,
                batters_faced=bf,
                strikeouts=k,
                walks=bb,
                hits_allowed=hits_allowed,
                home_runs_allowed=hr_allowed,
                avg_velo=round(safe_div(rs_sum, rs_count), 1) if rs_count else None,
                avg_spin=round(safe_div(sr_sum, sr_count), 0) if sr_count else None,
                avg_extension=round(safe_div(ext_sum, ext_count), 1)
                if ext_count
                else None,
                k_pct=safe_pct(k, bf),
                bb_pct=safe_pct(bb, bf),
                whiff_pct=safe_pct(whiffs, swings),
                csw_pct=safe_pct(called_strikes + whiffs, total_pitches),
            )

        return PlayerSeasonStats(
            player_id=player_id,
            season=season,
            hitting=hitting,
            pitching=pitching,
        )
