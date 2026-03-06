from collections import defaultdict

from litestar import Controller, get

from backend.db import Client
from backend.models.hitting import (
    BattedBallLeaderboard,
    BattedBallRow,
    ExpectedStatsLeaderboard,
    ExpectedStatsRow,
    HittingLeaderboard,
    PlatoonLeaderboard,
    PlatoonRow,
)
from backend.services.stats import get_hitting_leaderboard
from backend.utils import safe_div, safe_pct

_XSTATS_SORT_COLS = {
    "ba_diff",
    "woba_diff",
    "ba",
    "xba",
    "woba",
    "xwoba",
    "pa",
}

_BB_SORT_COLS = {
    "gb_pct",
    "fb_pct",
    "ld_pct",
    "popup_pct",
    "pull_pct",
    "center_pct",
    "oppo_pct",
    "sweet_spot_pct",
    "barrel_pct",
    "hard_hit_pct",
    "avg_la",
    "avg_ev",
    "max_ev",
    "bbe",
}

_PLATOON_SORT_COLS = {
    "ops_diff",
    "ops_vl",
    "ops_vr",
    "avg_vl",
    "avg_vr",
    "pa_vl",
    "pa_vr",
}


class HittingController(Controller):
    path = "/api/hitting"

    @get("/leaderboard")
    async def leaderboard(
        self,
        client: Client,
        season: int = 2025,
        min_pa: int = 50,
        team: str | None = None,
        sort: str = "ops",
        limit: int = 50,
    ) -> HittingLeaderboard:
        players = get_hitting_leaderboard(client, season, min_pa, team, sort, limit)
        return HittingLeaderboard(players=players, season=season, total=len(players))

    @get("/expected-stats")
    async def expected_stats(
        self,
        client: Client,
        season: int = 2025,
        min_pa: int = 100,
        sort: str = "woba_diff",
        limit: int = 50,
    ) -> ExpectedStatsLeaderboard:
        result = client.query(
            """
            SELECT
                h.batter AS player_id,
                p.name_full AS name,
                h.pa, h.ab, h.hits,
                h.xba_sum, h.xba_count,
                h.xwoba_sum, h.xwoba_count,
                w.woba
            FROM player_season_hitting AS h FINAL
            JOIN players AS p FINAL ON h.batter = p.player_id
            LEFT JOIN player_woba AS w FINAL
                ON h.batter = w.player_id AND w.season = {season:UInt16}
            WHERE h.season = {season:UInt16}
              AND h.pa >= {min_pa:UInt64}
              AND h.xba_count > 0
            """,
            parameters={"season": season, "min_pa": min_pa},
        )

        players = []
        for row in result.result_rows:
            (
                player_id,
                name,
                pa,
                ab,
                hits,
                xba_sum,
                xba_count,
                xwoba_sum,
                xwoba_count,
                woba,
            ) = row

            ba = round(safe_div(hits, ab), 3)
            xba = round(safe_div(xba_sum, xba_count), 3)
            xwoba = round(safe_div(xwoba_sum, xwoba_count), 3)
            woba_val = round(woba, 3) if woba is not None else None

            players.append(
                ExpectedStatsRow(
                    player_id=player_id,
                    name=name,
                    pa=pa,
                    ba=ba,
                    xba=xba,
                    ba_diff=round(ba - xba, 3),
                    woba=woba_val,
                    xwoba=xwoba,
                    woba_diff=round(woba_val - xwoba, 3)
                    if woba_val is not None
                    else None,
                )
            )

        if sort in _XSTATS_SORT_COLS:
            players.sort(
                key=lambda p: (
                    getattr(p, sort) if getattr(p, sort) is not None else -999
                ),
                reverse=True,
            )

        players = players[:limit]
        return ExpectedStatsLeaderboard(
            players=players, season=season, total=len(players)
        )

    @get("/batted-ball")
    async def batted_ball(
        self,
        client: Client,
        season: int = 2025,
        min_bbe: int = 25,
        sort: str = "bbe",
        limit: int = 50,
    ) -> BattedBallLeaderboard:
        result = client.query(
            """
            SELECT
                b.batter AS player_id,
                p.name_full AS name,
                b.bbe, b.gb, b.fb, b.ld, b.popup,
                b.pull_count, b.center_count, b.oppo_count,
                b.sweet_spot, b.barrel_count, b.hard_hit_count,
                b.avg_la, b.avg_ev, b.max_ev
            FROM batter_batted_ball AS b FINAL
            JOIN players AS p FINAL ON b.batter = p.player_id
            WHERE b.season = {season:UInt16}
              AND b.bbe >= {min_bbe:UInt32}
            """,
            parameters={"season": season, "min_bbe": min_bbe},
        )

        players = []
        for row in result.result_rows:
            (
                player_id,
                name,
                bbe,
                gb,
                fb,
                ld,
                popup,
                pull,
                center,
                oppo,
                sweet_spot,
                barrel,
                hard_hit,
                avg_la,
                avg_ev,
                max_ev,
            ) = row

            players.append(
                BattedBallRow(
                    player_id=player_id,
                    name=name,
                    bbe=bbe,
                    gb_pct=safe_pct(gb, bbe),
                    fb_pct=safe_pct(fb, bbe),
                    ld_pct=safe_pct(ld, bbe),
                    popup_pct=safe_pct(popup, bbe),
                    pull_pct=safe_pct(pull, bbe),
                    center_pct=safe_pct(center, bbe),
                    oppo_pct=safe_pct(oppo, bbe),
                    sweet_spot_pct=safe_pct(sweet_spot, bbe),
                    barrel_pct=safe_pct(barrel, bbe),
                    hard_hit_pct=safe_pct(hard_hit, bbe),
                    avg_la=round(avg_la, 1),
                    avg_ev=round(avg_ev, 1),
                    max_ev=round(max_ev, 1),
                )
            )

        if sort in _BB_SORT_COLS:
            players.sort(key=lambda r: getattr(r, sort), reverse=True)

        players = players[:limit]
        return BattedBallLeaderboard(players=players, season=season, total=len(players))

    @get("/platoon")
    async def platoon(
        self,
        client: Client,
        season: int = 2025,
        min_pa: int = 30,
        sort: str = "ops_diff",
        limit: int = 50,
    ) -> PlatoonLeaderboard:
        result = client.query(
            """
            SELECT
                s.batter AS player_id,
                p.name_full AS name,
                s.p_throws,
                s.pa, s.ab, s.hits, s.home_runs,
                s.walks, s.strikeouts, s.hbp, s.sac_flies, s.total_bases,
                s.xwoba_sum, s.xwoba_count
            FROM batter_platoon_splits AS s FINAL
            JOIN players AS p FINAL ON s.batter = p.player_id
            WHERE s.season = {season:UInt16}
              AND s.pa >= {min_pa:UInt32}
            """,
            parameters={"season": season, "min_pa": min_pa},
        )

        # Group rows by player, pivot vs L / vs R
        splits: dict[int, dict] = defaultdict(
            lambda: {"name": "", "L": None, "R": None}
        )
        for row in result.result_rows:
            (
                pid,
                name,
                p_throws,
                pa,
                ab,
                hits,
                hr,
                bb,
                k,
                hbp,
                sf,
                tb,
                xwoba_sum,
                xwoba_count,
            ) = row

            avg = round(safe_div(hits, ab), 3)
            obp = round(safe_div(hits + bb + hbp, ab + bb + hbp + sf), 3)
            slg = round(safe_div(tb, ab), 3)
            ops = round(obp + slg, 3)
            k_pct = round(safe_div(k, pa) * 100, 1)
            xwoba = (
                round(safe_div(xwoba_sum, xwoba_count), 3) if xwoba_count > 0 else None
            )

            splits[pid]["name"] = name
            splits[pid][p_throws] = {
                "pa": pa,
                "avg": avg,
                "obp": obp,
                "slg": slg,
                "ops": ops,
                "k_pct": k_pct,
                "xwoba": xwoba,
            }

        # Build rows only for players with both splits
        players = []
        for pid, data in splits.items():
            vl = data.get("L")
            vr = data.get("R")
            if not vl or not vr:
                continue
            players.append(
                PlatoonRow(
                    player_id=pid,
                    name=data["name"],
                    pa_vl=vl["pa"],
                    avg_vl=vl["avg"],
                    obp_vl=vl["obp"],
                    slg_vl=vl["slg"],
                    ops_vl=vl["ops"],
                    k_pct_vl=vl["k_pct"],
                    xwoba_vl=vl["xwoba"],
                    pa_vr=vr["pa"],
                    avg_vr=vr["avg"],
                    obp_vr=vr["obp"],
                    slg_vr=vr["slg"],
                    ops_vr=vr["ops"],
                    k_pct_vr=vr["k_pct"],
                    xwoba_vr=vr["xwoba"],
                    ops_diff=round(vl["ops"] - vr["ops"], 3),
                )
            )

        if sort in _PLATOON_SORT_COLS:
            players.sort(
                key=lambda r: (
                    getattr(r, sort) if getattr(r, sort) is not None else -999
                ),
                reverse=True,
            )

        players = players[:limit]
        return PlatoonLeaderboard(players=players, season=season, total=len(players))
