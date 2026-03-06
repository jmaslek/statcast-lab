from litestar import Controller, get
from backend.db import Client
from backend.models.compare import CompareResponse, ComparePlayerStats


class CompareController(Controller):
    path = "/api/compare"

    @get("/")
    async def compare_players(
        self, client: Client, players: str, season: int = 2025
    ) -> CompareResponse:
        """Compare multiple players. players param is comma-separated IDs, e.g. '660271,545361'"""
        player_ids = [int(pid.strip()) for pid in players.split(",")]

        results = []
        for pid in player_ids[:3]:  # Max 3 players
            # Get player info
            info = client.query(
                "SELECT player_id, name_full, position, team FROM players FINAL WHERE player_id = {pid:UInt32}",
                parameters={"pid": pid},
            )
            if not info.result_rows:
                continue

            row = info.result_rows[0]

            # Get hitting stats (same query pattern as player stats endpoint)
            hitting = client.query(
                """SELECT pa, ab, hits, singles, doubles, triples, home_runs,
                       walks, strikeouts, hbp, sac_flies, total_bases,
                       launch_speed_sum, launch_speed_count,
                       barrel_count, batted_ball_events, hard_hit_count
                FROM player_season_hitting FINAL
                WHERE batter = {pid:UInt32} AND season = {season:UInt16}""",
                parameters={"pid": pid, "season": season},
            )

            pitching = client.query(
                """SELECT total_pitches, batters_faced, strikeouts, walks,
                       hits_allowed, home_runs_allowed,
                       release_speed_sum, release_speed_count,
                       spin_rate_sum, spin_rate_count,
                       whiffs, called_strikes, swings, zone_pitches
                FROM player_season_pitching FINAL
                WHERE pitcher = {pid:UInt32} AND season = {season:UInt16}""",
                parameters={"pid": pid, "season": season},
            )

            hitting_dict = None
            if hitting.result_rows:
                h = hitting.result_rows[0]
                pa, ab, hits_count = h[0], h[1], h[2]
                ls_sum, ls_count = h[12], h[13]
                barrel_count, bbe, hh_count = h[14], h[15], h[16]
                hitting_dict = {
                    "pa": pa,
                    "ab": ab,
                    "hits": hits_count,
                    "home_runs": h[6],
                    "walks": h[7],
                    "strikeouts": h[8],
                    "avg": round(hits_count / ab, 3) if ab > 0 else 0,
                    "obp": (
                        round(
                            (hits_count + h[7] + h[9]) / (ab + h[7] + h[9] + h[10]), 3
                        )
                        if (ab + h[7] + h[9] + h[10]) > 0
                        else 0
                    ),
                    "slg": round(h[11] / ab, 3) if ab > 0 else 0,
                    "avg_exit_velo": round(ls_sum / ls_count, 1)
                    if ls_count > 0
                    else None,
                    "barrel_pct": round(barrel_count / bbe * 100, 1) if bbe > 0 else 0,
                    "hard_hit_pct": round(hh_count / bbe * 100, 1) if bbe > 0 else 0,
                }

            pitching_dict = None
            if pitching.result_rows:
                p = pitching.result_rows[0]
                bf = p[1]
                rs_sum, rs_count = p[6], p[7]
                sr_sum, sr_count = p[8], p[9]
                whiffs, _cs, swings = p[10], p[11], p[12]
                pitching_dict = {
                    "total_pitches": p[0],
                    "batters_faced": bf,
                    "strikeouts": p[2],
                    "walks": p[3],
                    "k_pct": round(p[2] / bf * 100, 1) if bf > 0 else 0,
                    "bb_pct": round(p[3] / bf * 100, 1) if bf > 0 else 0,
                    "whiff_pct": round(whiffs / swings * 100, 1) if swings > 0 else 0,
                    "avg_velo": round(rs_sum / rs_count, 1) if rs_count > 0 else None,
                    "avg_spin": round(sr_sum / sr_count, 0) if sr_count > 0 else None,
                }

            results.append(
                ComparePlayerStats(
                    player_id=row[0],
                    name=row[1],
                    position=row[2],
                    team=row[3],
                    season=season,
                    hitting=hitting_dict,
                    pitching=pitching_dict,
                )
            )

        return CompareResponse(players=results, season=season)
