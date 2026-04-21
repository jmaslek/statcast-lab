from litestar import Controller, get

from backend.db import Client
from backend.models.search import SearchAggRow, SearchPitch, SearchResult
from backend.utils import safe_div

_ALLOWED_PITCH_TYPES = {
    "FF", "SI", "SL", "CU", "CH", "FC", "FS", "KC", "ST", "SV", "KN",
}

_ALLOWED_BB_TYPES = {"fly_ball", "ground_ball", "line_drive", "popup"}

_ALLOWED_EVENTS = {
    "single", "double", "triple", "home_run",
    "strikeout", "strikeout_double_play", "walk",
    "field_out", "grounded_into_double_play", "force_out",
    "sac_fly", "sac_bunt", "hit_by_pitch", "fielders_choice",
    "double_play", "field_error",
}


class SearchController(Controller):
    path = "/api/search"

    @get("/pitches")
    async def search_pitches(
        self,
        client: Client,
        season: int = 2026,
        pitch_type: str | None = None,
        batter: int | None = None,
        pitcher: int | None = None,
        batter_team: str | None = None,
        pitcher_team: str | None = None,
        stand: str | None = None,
        p_throws: str | None = None,
        balls: int | None = None,
        strikes: int | None = None,
        events: str | None = None,
        description: str | None = None,
        bb_type: str | None = None,
        min_velo: float | None = None,
        max_velo: float | None = None,
        min_ev: float | None = None,
        max_ev: float | None = None,
        min_la: float | None = None,
        max_la: float | None = None,
        barrel: bool | None = None,
        zone: str | None = None,
        limit: int = 500,
    ) -> SearchResult:
        """Search raw pitch-level data with various filters."""
        conditions: list[str] = ["game_year = {season:UInt16}"]
        params: dict = {"season": season}

        if pitch_type and pitch_type in _ALLOWED_PITCH_TYPES:
            conditions.append("pitch_type = {pitch_type:String}")
            params["pitch_type"] = pitch_type

        if batter is not None:
            conditions.append("batter = {batter:UInt32}")
            params["batter"] = batter

        if pitcher is not None:
            conditions.append("pitcher = {pitcher:UInt32}")
            params["pitcher"] = pitcher

        if batter_team:
            conditions.append(
                "(home_team = {batter_team:String} AND inning_topbot = 'Bot'"
                " OR away_team = {batter_team:String} AND inning_topbot = 'Top')"
            )
            params["batter_team"] = batter_team

        if pitcher_team:
            conditions.append(
                "(home_team = {pitcher_team:String} AND inning_topbot = 'Top'"
                " OR away_team = {pitcher_team:String} AND inning_topbot = 'Bot')"
            )
            params["pitcher_team"] = pitcher_team

        if stand in ("L", "R"):
            conditions.append("stand = {stand:String}")
            params["stand"] = stand

        if p_throws in ("L", "R"):
            conditions.append("p_throws = {p_throws:String}")
            params["p_throws"] = p_throws

        if balls is not None and 0 <= balls <= 3:
            conditions.append("balls = {balls:UInt8}")
            params["balls"] = balls

        if strikes is not None and 0 <= strikes <= 2:
            conditions.append("strikes = {strikes:UInt8}")
            params["strikes"] = strikes

        if events and events in _ALLOWED_EVENTS:
            conditions.append("events = {events:String}")
            params["events"] = events

        if description:
            conditions.append("description = {description:String}")
            params["description"] = description

        if bb_type and bb_type in _ALLOWED_BB_TYPES:
            conditions.append("bb_type = {bb_type:String}")
            params["bb_type"] = bb_type

        if min_velo is not None:
            conditions.append("release_speed >= {min_velo:Float32}")
            params["min_velo"] = min_velo

        if max_velo is not None:
            conditions.append("release_speed <= {max_velo:Float32}")
            params["max_velo"] = max_velo

        if min_ev is not None:
            conditions.append("launch_speed >= {min_ev:Float32}")
            params["min_ev"] = min_ev

        if max_ev is not None:
            conditions.append("launch_speed <= {max_ev:Float32}")
            params["max_ev"] = max_ev

        if min_la is not None:
            conditions.append("launch_angle >= {min_la:Float32}")
            params["min_la"] = min_la

        if max_la is not None:
            conditions.append("launch_angle <= {max_la:Float32}")
            params["max_la"] = max_la

        if barrel is True:
            conditions.append("barrel = 1")

        if zone:
            zone_list = [int(z) for z in zone.split(",") if z.strip().isdigit()]
            if zone_list:
                zone_str = ", ".join(str(z) for z in zone_list)
                conditions.append(f"zone IN ({zone_str})")

        where = " AND ".join(conditions)
        safe_limit = min(limit, 1000)

        result = client.query(
            f"""
            SELECT
                toString(p.game_date),
                b.name_full,
                pit.name_full,
                CASE WHEN p.inning_topbot = 'Bot' THEN p.home_team ELSE p.away_team END,
                CASE WHEN p.inning_topbot = 'Top' THEN p.home_team ELSE p.away_team END,
                p.pitch_type, p.pitch_name,
                p.release_speed, p.pfx_x, p.pfx_z,
                p.plate_x, p.plate_z,
                p.launch_speed, p.launch_angle,
                p.hit_distance_sc,
                p.events, p.description, p.zone,
                p.stand, p.p_throws, p.balls, p.strikes,
                p.barrel,
                p.estimated_ba_using_speedangle,
                p.estimated_woba_using_speedangle,
                p.bat_speed, p.swing_length
            FROM pitches AS p
            LEFT JOIN players AS b FINAL ON p.batter = b.player_id
            LEFT JOIN players AS pit FINAL ON p.pitcher = pit.player_id
            WHERE {where}
            ORDER BY p.game_date DESC, p.game_pk, p.at_bat_number, p.pitch_number
            LIMIT {{limit:UInt32}}
            """,
            parameters={**params, "limit": safe_limit},
        )

        pitches = []
        for row in result.result_rows:
            (
                game_date, batter_name, pitcher_name, bat_team, pit_team,
                pt, pn, speed, pfx_x, pfx_z, plate_x, plate_z,
                ls, la, dist, ev, desc, zn,
                st, pt_throws, b, s, brl,
                xba, xwoba, bs, sl,
            ) = row
            pitches.append(SearchPitch(
                game_date=game_date,
                batter_name=batter_name,
                pitcher_name=pitcher_name,
                batter_team=bat_team,
                pitcher_team=pit_team,
                pitch_type=pt,
                pitch_name=pn,
                release_speed=speed,
                pfx_x=pfx_x,
                pfx_z=pfx_z,
                plate_x=plate_x,
                plate_z=plate_z,
                launch_speed=ls,
                launch_angle=la,
                hit_distance=dist,
                events=ev,
                description=desc,
                zone=zn,
                stand=st,
                p_throws=pt_throws,
                balls=b,
                strikes=s,
                barrel=brl,
                estimated_ba=round(xba, 3) if xba is not None else None,
                estimated_woba=round(xwoba, 3) if xwoba is not None else None,
                bat_speed=bs,
                swing_length=sl,
            ))

        return SearchResult(
            pitches=pitches, total=len(pitches), season=season, mode="pitches",
        )

    @get("/aggregate")
    async def search_aggregate(
        self,
        client: Client,
        season: int = 2026,
        group_by: str = "batter",
        pitch_type: str | None = None,
        batter_team: str | None = None,
        pitcher_team: str | None = None,
        stand: str | None = None,
        p_throws: str | None = None,
        balls: int | None = None,
        strikes: int | None = None,
        events: str | None = None,
        bb_type: str | None = None,
        min_velo: float | None = None,
        max_velo: float | None = None,
        min_ev: float | None = None,
        max_ev: float | None = None,
        min_la: float | None = None,
        max_la: float | None = None,
        barrel: bool | None = None,
        zone: str | None = None,
        min_pitches: int = 50,
        sort: str = "pitches",
        limit: int = 100,
        desc: bool = True,
    ) -> SearchResult:
        """Aggregate pitch data grouped by batter or pitcher."""
        group_col = "pitcher" if group_by == "pitcher" else "batter"

        conditions: list[str] = ["game_year = {season:UInt16}"]
        params: dict = {"season": season}

        if pitch_type and pitch_type in _ALLOWED_PITCH_TYPES:
            conditions.append("pitch_type = {pitch_type:String}")
            params["pitch_type"] = pitch_type

        if batter_team:
            conditions.append(
                "(home_team = {batter_team:String} AND inning_topbot = 'Bot'"
                " OR away_team = {batter_team:String} AND inning_topbot = 'Top')"
            )
            params["batter_team"] = batter_team

        if pitcher_team:
            conditions.append(
                "(home_team = {pitcher_team:String} AND inning_topbot = 'Top'"
                " OR away_team = {pitcher_team:String} AND inning_topbot = 'Bot')"
            )
            params["pitcher_team"] = pitcher_team

        if stand in ("L", "R"):
            conditions.append("stand = {stand:String}")
            params["stand"] = stand

        if p_throws in ("L", "R"):
            conditions.append("p_throws = {p_throws:String}")
            params["p_throws"] = p_throws

        if balls is not None and 0 <= balls <= 3:
            conditions.append("balls = {balls:UInt8}")
            params["balls"] = balls

        if strikes is not None and 0 <= strikes <= 2:
            conditions.append("strikes = {strikes:UInt8}")
            params["strikes"] = strikes

        if events and events in _ALLOWED_EVENTS:
            conditions.append("events = {events:String}")
            params["events"] = events

        if bb_type and bb_type in _ALLOWED_BB_TYPES:
            conditions.append("bb_type = {bb_type:String}")
            params["bb_type"] = bb_type

        if min_velo is not None:
            conditions.append("release_speed >= {min_velo:Float32}")
            params["min_velo"] = min_velo

        if max_velo is not None:
            conditions.append("release_speed <= {max_velo:Float32}")
            params["max_velo"] = max_velo

        if min_ev is not None:
            conditions.append("launch_speed >= {min_ev:Float32}")
            params["min_ev"] = min_ev

        if max_ev is not None:
            conditions.append("launch_speed <= {max_ev:Float32}")
            params["max_ev"] = max_ev

        if min_la is not None:
            conditions.append("launch_angle >= {min_la:Float32}")
            params["min_la"] = min_la

        if max_la is not None:
            conditions.append("launch_angle <= {max_la:Float32}")
            params["max_la"] = max_la

        if barrel is True:
            conditions.append("barrel = 1")

        if zone:
            zone_list = [int(z) for z in zone.split(",") if z.strip().isdigit()]
            if zone_list:
                zone_str = ", ".join(str(z) for z in zone_list)
                conditions.append(f"zone IN ({zone_str})")

        where = " AND ".join(conditions)
        order_dir = "DESC" if desc else "ASC"

        result = client.query(
            f"""
            SELECT
                p.{group_col} AS player_id,
                any(pl.name_full) AS name,
                count() AS pitches,
                avg(p.release_speed) AS avg_velo,
                max(p.release_speed) AS max_velo,
                avgIf(p.launch_speed, p.launch_speed IS NOT NULL) AS avg_ls,
                avgIf(p.launch_angle, p.launch_angle IS NOT NULL) AS avg_la,
                countIf(p.barrel = 1) AS barrels,
                countIf(p.launch_speed IS NOT NULL) AS bbe,
                countIf(p.description IN (
                    'swinging_strike', 'swinging_strike_blocked', 'foul_tip'
                )) AS whiffs,
                countIf(p.description IN (
                    'swinging_strike', 'swinging_strike_blocked', 'foul',
                    'foul_tip', 'hit_into_play', 'hit_into_play_no_out',
                    'hit_into_play_score'
                )) AS swings,
                avg(p.release_spin_rate) AS avg_spin,
                avgIf(p.estimated_ba_using_speedangle,
                      p.estimated_ba_using_speedangle IS NOT NULL) AS xba,
                avgIf(p.estimated_woba_using_speedangle,
                      p.estimated_woba_using_speedangle IS NOT NULL) AS xwoba,
                countIf(p.launch_speed >= 95) AS hard_hits
            FROM pitches AS p
            LEFT JOIN players AS pl FINAL ON p.{group_col} = pl.player_id
            WHERE {where}
            GROUP BY p.{group_col}
            HAVING pitches >= {{min_pitches:UInt32}}
            ORDER BY pitches {order_dir}
            LIMIT {{limit:UInt32}}
            """,
            parameters={**params, "min_pitches": min_pitches, "limit": limit},
        )

        rows = []
        for row in result.result_rows:
            (
                player_id, name, pitches, avg_velo, max_velo,
                avg_ls, avg_la, barrels, bbe, whiffs, swings,
                avg_spin, xba, xwoba, hard_hits,
            ) = row
            rows.append(SearchAggRow(
                player_id=player_id,
                name=name or "Unknown",
                pitches=pitches,
                avg_velo=round(avg_velo, 1) if avg_velo is not None else None,
                max_velo=round(max_velo, 1) if max_velo is not None else None,
                avg_launch_speed=round(avg_ls, 1) if avg_ls is not None else None,
                avg_launch_angle=round(avg_la, 1) if avg_la is not None else None,
                barrel_pct=round(safe_div(barrels, bbe) * 100, 1) if bbe else None,
                whiff_pct=round(safe_div(whiffs, swings) * 100, 1) if swings else None,
                avg_spin=round(avg_spin) if avg_spin is not None else None,
                xba=round(xba, 3) if xba is not None else None,
                xwoba=round(xwoba, 3) if xwoba is not None else None,
                hard_hit_pct=round(safe_div(hard_hits, bbe) * 100, 1) if bbe else None,
            ))

        # Sort by requested column
        _SORT_COLS = {
            "pitches", "avg_velo", "max_velo", "avg_launch_speed",
            "avg_launch_angle", "barrel_pct", "whiff_pct", "avg_spin",
            "xba", "xwoba", "hard_hit_pct",
        }
        if sort in _SORT_COLS:
            rows.sort(
                key=lambda r: (
                    getattr(r, sort) is not None,
                    getattr(r, sort) if getattr(r, sort) is not None else 0,
                ),
                reverse=desc,
            )

        return SearchResult(
            aggregated=rows, total=len(rows), season=season, mode="aggregated",
        )
