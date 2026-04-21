from collections import defaultdict

from litestar import Controller, get

from backend.db import Client
from backend.models.hitting import (
    AbsChallengeEvent,
    AbsChallengeEventList,
    AbsChallengeRow,
    AbsLeaderboard,
    BaserunningLeaderboard,
    BaserunningRow,
    BatTrackingLeaderboard,
    BatTrackingRow,
    BattedBallLeaderboard,
    BattedBallRow,
    ExpectedStatsLeaderboard,
    ExpectedStatsRow,
    HittingLeaderboard,
    PitcherBaserunningLeaderboard,
    PitcherBaserunningRow,
    PlatoonLeaderboard,
    PlatoonRow,
)
from backend.services.stats import get_hitting_leaderboard
from backend.utils import safe_div, safe_pct, sort_and_limit

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
        desc: bool = True,
        offset: int = 0,
    ) -> HittingLeaderboard:
        players, total = get_hitting_leaderboard(client, season, min_pa, team, sort, limit, desc=desc, offset=offset)
        return HittingLeaderboard(players=players, season=season, total=total)

    @get("/expected-stats")
    async def expected_stats(
        self,
        client: Client,
        season: int = 2025,
        min_pa: int = 100,
        sort: str = "woba_diff",
        limit: int = 50,
        desc: bool = True,
        offset: int = 0,
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

        players, total = sort_and_limit(players, sort, _XSTATS_SORT_COLS, desc, limit, offset=offset)
        return ExpectedStatsLeaderboard(
            players=players, season=season, total=total
        )

    @get("/batted-ball")
    async def batted_ball(
        self,
        client: Client,
        season: int = 2025,
        min_bbe: int = 25,
        sort: str = "bbe",
        limit: int = 50,
        desc: bool = True,
        offset: int = 0,
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

        players, total = sort_and_limit(players, sort, _BB_SORT_COLS, desc, limit, offset=offset)
        return BattedBallLeaderboard(players=players, season=season, total=total)

    @get("/platoon")
    async def platoon(
        self,
        client: Client,
        season: int = 2025,
        min_pa: int = 30,
        sort: str = "ops_diff",
        limit: int = 50,
        desc: bool = True,
        offset: int = 0,
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

        players, total = sort_and_limit(players, sort, _PLATOON_SORT_COLS, desc, limit, offset=offset)
        return PlatoonLeaderboard(players=players, season=season, total=total)

    @get("/baserunning")
    async def baserunning(
        self,
        client: Client,
        season: int = 2026,
        min_att: int = 3,
        sort: str = "sb",
        limit: int = 50,
        desc: bool = True,
        offset: int = 0,
    ) -> BaserunningLeaderboard:
        """Baserunning leaderboard from play-by-play runner events."""
        result = client.query(
            """
            SELECT
                pr.runner_id,
                p.name_full AS name,
                countIf(pr.movement_reason LIKE 'r_stolen_base%') AS sb,
                countIf(pr.movement_reason LIKE 'r_caught_stealing%'
                     OR pr.movement_reason LIKE 'r_pickoff_caught_stealing%') AS cs,
                countIf(pr.movement_reason = 'r_stolen_base_2b') AS sb_2b,
                countIf(pr.movement_reason = 'r_stolen_base_3b') AS sb_3b,
                countIf(pr.movement_reason = 'r_stolen_base_home') AS sb_home,
                countIf(pr.movement_reason LIKE 'r_pickoff_%'
                    AND pr.movement_reason NOT LIKE '%caught_stealing%'
                    AND pr.movement_reason NOT LIKE '%error%') AS pickoffs,
                countIf(pr.event = 'Wild Pitch') AS wp_advances,
                countIf(pr.event = 'Passed Ball') AS pb_advances
            FROM play_runners AS pr
            LEFT JOIN players AS p FINAL ON pr.runner_id = p.player_id
            WHERE pr.season = {season:UInt16}
            GROUP BY pr.runner_id, p.name_full
            HAVING sb + cs >= {min_att:UInt32}
            """,
            parameters={"season": season, "min_att": min_att},
        )

        players = []
        for (
            player_id, name, sb, cs,
            sb_2b, sb_3b, sb_home,
            pickoffs, wp_adv, pb_adv,
        ) in result.result_rows:
            total_att = sb + cs
            sb_pct = round(safe_div(sb, total_att) * 100, 1) if total_att else 0.0
            # Approximate baserunning runs: SB*0.2 - CS*0.45
            br_runs = round(sb * 0.2 - cs * 0.45, 1)

            players.append(BaserunningRow(
                player_id=player_id,
                name=name or str(player_id),
                sb=sb, cs=cs, sb_pct=sb_pct,
                sb_2b=sb_2b, sb_3b=sb_3b, sb_home=sb_home,
                pickoffs=pickoffs,
                wp_advances=wp_adv, pb_advances=pb_adv,
                br_runs=br_runs,
            ))

        _BR_SORT_COLS = {
            "sb", "cs", "sb_pct", "sb_2b", "sb_3b",
            "pickoffs", "wp_advances", "pb_advances", "br_runs",
        }
        players, total = sort_and_limit(players, sort, _BR_SORT_COLS, desc, limit, offset=offset)
        return BaserunningLeaderboard(players=players, season=season, total=total)

    @get("/baserunning/pitchers")
    async def baserunning_pitchers(
        self,
        client: Client,
        season: int = 2026,
        min_att: int = 3,
        sort: str = "sb_against",
        limit: int = 50,
        desc: bool = True,
        offset: int = 0,
    ) -> PitcherBaserunningLeaderboard:
        """Pitcher baserunning-allowed stats from play-by-play."""
        result = client.query(
            """
            SELECT
                pr.pitcher_id,
                p.name_full AS name,
                countIf(pr.movement_reason LIKE 'r_stolen_base%') AS sb_against,
                countIf(pr.movement_reason LIKE 'r_caught_stealing%'
                     OR pr.movement_reason LIKE 'r_pickoff_caught_stealing%') AS cs_by,
                countIf(pr.event = 'Wild Pitch') AS wp,
                countIf(pr.event = 'Balk') AS balk,
                countIf(pr.movement_reason LIKE 'r_pickoff_%') AS pickoff_attempts,
                countIf(pr.movement_reason LIKE 'r_pickoff_%'
                    AND pr.is_out = 1) AS pickoff_outs
            FROM play_runners AS pr
            LEFT JOIN players AS p FINAL ON pr.pitcher_id = p.player_id
            WHERE pr.season = {season:UInt16}
              AND pr.movement_reason IS NOT NULL
              AND (pr.movement_reason LIKE 'r_stolen%'
                OR pr.movement_reason LIKE 'r_caught%'
                OR pr.movement_reason LIKE 'r_pickoff%'
                OR pr.event IN ('Wild Pitch', 'Balk'))
            GROUP BY pr.pitcher_id, p.name_full
            HAVING sb_against + cs_by >= {min_att:UInt32}
            """,
            parameters={"season": season, "min_att": min_att},
        )

        players = []
        for (
            player_id, name, sb_against, cs_by,
            wp, balk, pickoff_att, pickoff_outs,
        ) in result.result_rows:
            total_att = sb_against + cs_by
            sb_pct_against = round(safe_div(sb_against, total_att) * 100, 1) if total_att else 0.0

            players.append(PitcherBaserunningRow(
                player_id=player_id,
                name=name or str(player_id),
                sb_against=sb_against, cs_by=cs_by,
                sb_pct_against=sb_pct_against,
                wp=wp, balk=balk,
                pickoff_attempts=pickoff_att,
                pickoff_outs=pickoff_outs,
            ))

        _PBR_SORT_COLS = {
            "sb_against", "cs_by", "sb_pct_against",
            "wp", "balk", "pickoff_attempts", "pickoff_outs",
        }
        players, total = sort_and_limit(players, sort, _PBR_SORT_COLS, desc, limit, offset=offset)
        return PitcherBaserunningLeaderboard(players=players, season=season, total=total)

    @get("/abs")
    async def abs_leaderboard(
        self,
        client: Client,
        season: int = 2026,
        challenge_type: str = "batter",
        sort: str = "challenges",
        limit: int = 50,
        desc: bool = True,
        offset: int = 0,
    ) -> AbsLeaderboard:
        """ABS challenge leaderboard — reads from abs_challenges (full-season aggregates from Savant CSV)."""
        valid_types = {"batter", "pitcher", "catcher", "batting-team"}
        if challenge_type not in valid_types:
            challenge_type = "batter"

        result = client.query(
            """
            SELECT
                entity_name,
                team_abbr,
                n_challenges,
                n_overturns,
                n_confirms,
                rate_overturns,
                n_strikeouts_flip,
                n_walks_flip
            FROM abs_challenges FINAL
            WHERE season = {season:UInt16}
              AND challenge_type = {challenge_type:String}
            """,
            parameters={"season": season, "challenge_type": challenge_type},
        )

        rows = []
        for (
            name, team, challenges, overturns, confirms,
            overturn_pct, k_flips, bb_flips,
        ) in result.result_rows:
            rows.append(AbsChallengeRow(
                name=name,
                team=team,
                challenges=challenges,
                overturns=overturns,
                confirms=confirms,
                overturn_pct=round(overturn_pct, 3) if overturn_pct else 0,
                k_flips=k_flips,
                bb_flips=bb_flips,
            ))

        _ABS_SORT_COLS = {
            "challenges", "overturns", "overturn_pct",
            "k_flips", "bb_flips",
        }
        rows, total = sort_and_limit(rows, sort, _ABS_SORT_COLS, desc, limit, offset=offset)
        return AbsLeaderboard(
            rows=rows, season=season, challenge_type=challenge_type, total=total,
        )

    @get("/abs/events")
    async def abs_events(
        self,
        client: Client,
        name: str = "",
        season: int = 2026,
        role: str = "batter",
    ) -> AbsChallengeEventList:
        """Get individual ABS challenge events for a player."""
        if not name:
            return AbsChallengeEventList(
                events=[], entity_name="", season=season, total=0,
            )

        # Map role to name column AND the challenge initiator flag
        col_map = {
            "batter": ("batter_name", "is_batter_challenge"),
            "pitcher": ("pitcher_name", "is_pitcher_challenge"),
            "catcher": ("catcher_name", "is_catcher_challenge"),
        }
        name_col, flag_col = col_map.get(role, ("batter_name", "is_batter_challenge"))

        result = client.query(
            f"""
            SELECT game_pk, play_id, game_date, event_inning, outs,
                   pre_ball_count, pre_strike_count,
                   batter_name, pitcher_name, catcher_name,
                   bat_team_abbr, fld_team_abbr,
                   plate_x, plate_z, sz_top, sz_bot,
                   original_is_strike, is_overturned,
                   is_strike3_added, is_strike3_removed,
                   is_ball4_added, is_ball4_removed,
                   edge_dist
            FROM abs_challenge_events FINAL
            WHERE season = {{season:UInt16}}
              AND {name_col} = {{name:String}}
              AND {flag_col} = 1
            ORDER BY game_date, event_inning
            """,
            parameters={"season": season, "name": name},
        )

        events = []
        for (
            game_pk, play_id, game_date, inning, outs,
            balls, strikes,
            batter, pitcher, catcher,
            bat_team, fld_team,
            px, pz, sz_top, sz_bot,
            orig_strike, overturned,
            k3_add, k3_rem, bb4_add, bb4_rem,
            edge,
        ) in result.result_rows:
            original_call = "Strike" if orig_strike else "Ball"
            if overturned:
                result_str = "Ball → Strike" if orig_strike == 0 else "Strike → Ball"
            else:
                result_str = "Confirmed " + original_call

            # Add context for K/BB flips
            if k3_add:
                result_str += " (K added)"
            elif k3_rem:
                result_str += " (K removed)"
            elif bb4_add:
                result_str += " (BB added)"
            elif bb4_rem:
                result_str += " (BB removed)"

            events.append(AbsChallengeEvent(
                game_pk=game_pk,
                play_id=play_id,
                game_date=game_date.isoformat(),
                inning=inning,
                outs=outs,
                count=f"{balls}-{strikes}",
                batter_name=batter,
                pitcher_name=pitcher,
                catcher_name=catcher,
                bat_team=bat_team,
                fld_team=fld_team,
                plate_x=round(px, 3),
                plate_z=round(pz, 3),
                sz_top=round(sz_top, 3),
                sz_bot=round(sz_bot, 3),
                original_call=original_call,
                result=result_str,
                is_overturned=bool(overturned),
                edge_dist=round(edge, 2),
            ))

        # Get the real total from the full-season aggregate table
        agg_result = client.query(
            """
            SELECT n_challenges
            FROM abs_challenges FINAL
            WHERE season = {season:UInt16}
              AND challenge_type = {ct:String}
              AND entity_name = {name:String}
            LIMIT 1
            """,
            parameters={
                "season": season,
                "ct": role,
                "name": name,
            },
        )
        agg_total = agg_result.result_rows[0][0] if agg_result.result_rows else len(events)

        return AbsChallengeEventList(
            events=events, entity_name=name, season=season, total=agg_total,
        )

    @get("/bat-tracking")
    async def bat_tracking(
        self,
        client: Client,
        season: int = 2026,
        min_swings: int = 50,
        sort: str = "avg_bat_speed",
        limit: int = 50,
        desc: bool = True,
        offset: int = 0,
    ) -> BatTrackingLeaderboard:
        """Bat tracking leaderboard: bat speed, swing length, etc."""
        result = client.query(
            """
            SELECT
                batter,
                p.name_full,
                count() AS swings,
                avg(bat_speed) AS avg_bat_speed,
                max(bat_speed) AS max_bat_speed,
                avg(swing_length) AS avg_swing_length,
                countIf(bat_speed >= 75) AS fast_swings,
                avgIf(bat_speed, barrel = 1) AS avg_barrel_bat_speed
            FROM pitches
            LEFT JOIN players AS p FINAL ON batter = p.player_id
            WHERE game_year = {season:UInt16}
              AND game_type = 'R'
              AND bat_speed IS NOT NULL
            GROUP BY batter, p.name_full
            HAVING swings >= {min_swings:UInt32}
            """,
            parameters={"season": season, "min_swings": min_swings},
        )

        players = []
        for (
            batter, name, swings, avg_bat_speed, max_bat_speed,
            avg_swing_length, fast_swings, avg_barrel_bat_speed,
        ) in result.result_rows:
            fast_swing_rate = round(safe_div(fast_swings, swings) * 100, 1)
            players.append(BatTrackingRow(
                player_id=batter,
                name=name or str(batter),
                swings=swings,
                avg_bat_speed=round(avg_bat_speed, 1),
                max_bat_speed=round(max_bat_speed, 1),
                avg_swing_length=round(avg_swing_length, 1) if avg_swing_length is not None else None,
                fast_swing_rate=fast_swing_rate,
                avg_barrel_bat_speed=round(avg_barrel_bat_speed, 1) if avg_barrel_bat_speed is not None else None,
            ))

        _BT_SORT_COLS = {
            "avg_bat_speed", "max_bat_speed", "avg_swing_length",
            "fast_swing_rate", "avg_barrel_bat_speed", "swings",
        }
        players, total = sort_and_limit(players, sort, _BT_SORT_COLS, desc, limit, offset=offset)
        return BatTrackingLeaderboard(
            players=players, season=season, total=total,
        )
