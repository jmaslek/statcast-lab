from litestar import Controller, get
from backend.db import Client
from backend.models.charts import (
    SprayChartData,
    SprayChartPoint,
    ZoneData,
    ZonePoint,
    ZoneProfileBin,
    ZoneProfileData,
    MovementData,
    MovementPoint,
    LeagueAverageMovement,
    PitchTypeSummary,
)
from backend.utils import safe_div


class ChartController(Controller):
    path = "/api/charts"

    @get("/spray/{player_id:int}")
    async def spray_chart(self, client: Client, player_id: int, season: int = 2025) -> SprayChartData:
        result = client.query(
            """
            SELECT hc_x, hc_y, events, launch_speed, launch_angle, bb_type
            FROM pitches
            WHERE batter = {pid:UInt32}
              AND game_year = {season:UInt16}
              AND hc_x IS NOT NULL
              AND hc_y IS NOT NULL
              AND events IS NOT NULL
            """,
            parameters={"pid": player_id, "season": season},
        )
        points = [
            SprayChartPoint(
                hc_x=r[0],
                hc_y=r[1],
                events=r[2],
                launch_speed=r[3],
                launch_angle=r[4],
                bb_type=r[5],
            )
            for r in result.result_rows
        ]
        return SprayChartData(points=points, player_id=player_id, season=season)

    @get("/zone/{player_id:int}")
    async def strike_zone(
        self, client: Client, player_id: int, season: int = 2025, role: str = "batter"
    ) -> ZoneData:
        """Get pitch locations. role='batter' for pitches seen, role='pitcher' for pitches thrown."""
        col = "batter" if role == "batter" else "pitcher"
        result = client.query(
            f"""
            SELECT plate_x, plate_z, description, pitch_type, release_speed
            FROM pitches
            WHERE {col} = {{pid:UInt32}}
              AND game_year = {{season:UInt16}}
              AND plate_x IS NOT NULL
              AND plate_z IS NOT NULL
            """,
            parameters={"pid": player_id, "season": season},
        )
        points = [
            ZonePoint(
                plate_x=r[0],
                plate_z=r[1],
                description=r[2],
                pitch_type=r[3],
                release_speed=r[4],
            )
            for r in result.result_rows
        ]
        return ZoneData(points=points, player_id=player_id, season=season)

    @get("/movement/{player_id:int}")
    async def pitch_movement(self, client: Client, player_id: int, season: int = 2025) -> MovementData:

        # 1. Pitcher's pitches (convert feet to inches)
        pitch_result = client.query(
            """
            SELECT pfx_x * 12 AS pfx_x, pfx_z * 12 AS pfx_z,
                   pitch_type, pitch_name, release_speed,
                   any(p_throws) OVER () AS p_throws
            FROM pitches
            WHERE pitcher = {pid:UInt32}
              AND game_year = {season:UInt16}
              AND pfx_x IS NOT NULL
              AND pfx_z IS NOT NULL
              AND pitch_type IS NOT NULL
            """,
            parameters={"pid": player_id, "season": season},
        )
        points = [
            MovementPoint(
                pfx_x=r[0],
                pfx_z=r[1],
                pitch_type=r[2],
                pitch_name=r[3],
                release_speed=r[4],
            )
            for r in pitch_result.result_rows
        ]
        p_throws = pitch_result.result_rows[0][5] if pitch_result.result_rows else "R"

        # 2. League averages by pitch type for same handedness
        league_result = client.query(
            """
            SELECT pitch_type,
                   any(pitch_name) AS pitch_name,
                   avg(pfx_x * 12) AS avg_pfx_x,
                   avg(pfx_z * 12) AS avg_pfx_z,
                   stddevPop(pfx_x * 12) AS std_pfx_x,
                   stddevPop(pfx_z * 12) AS std_pfx_z,
                   count() AS cnt,
                   avg(release_speed) AS avg_speed
            FROM pitches
            WHERE game_year = {season:UInt16}
              AND p_throws = {hand:String}
              AND pfx_x IS NOT NULL
              AND pfx_z IS NOT NULL
              AND pitch_type IS NOT NULL
            GROUP BY pitch_type
            HAVING count() >= 100
            """,
            parameters={"season": season, "hand": p_throws},
        )
        league_avgs = [
            LeagueAverageMovement(
                pitch_type=r[0],
                pitch_name=r[1],
                avg_pfx_x=r[2],
                avg_pfx_z=r[3],
                std_pfx_x=r[4],
                std_pfx_z=r[5],
                count=r[6],
            )
            for r in league_result.result_rows
        ]
        # Build lookup for league avg speed
        league_speed_map = {r[0]: r[7] for r in league_result.result_rows}

        # 3. Pitcher's pitch summary
        summary_result = client.query(
            """
            SELECT pitch_type,
                   any(pitch_name) AS pitch_name,
                   count() AS cnt,
                   avg(release_speed) AS avg_speed
            FROM pitches
            WHERE pitcher = {pid:UInt32}
              AND game_year = {season:UInt16}
              AND pitch_type IS NOT NULL
            GROUP BY pitch_type
            """,
            parameters={"pid": player_id, "season": season},
        )
        total_pitches = sum(r[2] for r in summary_result.result_rows)
        pitch_summary = [
            PitchTypeSummary(
                pitch_type=r[0],
                pitch_name=r[1],
                usage_pct=round(r[2] / total_pitches * 100, 1) if total_pitches else 0,
                avg_speed=r[3],
                count=r[2],
                league_avg_speed=league_speed_map.get(r[0]),
            )
            for r in summary_result.result_rows
        ]

        return MovementData(
            points=points,
            player_id=player_id,
            season=season,
            p_throws=p_throws,
            league_averages=league_avgs,
            pitch_summary=pitch_summary,
        )

    @get("/zone-profile/{player_id:int}")
    async def zone_profile(
        self, client: Client, player_id: int, season: int = 2026,
        role: str = "batter", metric: str = "whiff_pct",
    ) -> ZoneProfileData:
        """Pitch zone profile bucketed into a 7x7 grid with per-bin rates."""
        col = "batter" if role == "batter" else "pitcher"

        # Use ClickHouse to bucket pitches into a 7x7 grid
        # x: -1.5 to 1.5 (bin width ~0.4286), z: 1.0 to 4.0 (bin width ~0.4286)
        result = client.query(
            f"""
            SELECT
                floor((plate_x - (-1.5)) / ((1.5 - (-1.5)) / 7)) AS x_bin,
                floor((plate_z - 1.0) / ((4.0 - 1.0) / 7)) AS z_bin,
                count() AS total,
                countIf(description IN (
                    'swinging_strike','swinging_strike_blocked','foul_tip'
                )) AS whiffs,
                countIf(description IN (
                    'swinging_strike','swinging_strike_blocked','foul',
                    'foul_tip','hit_into_play','hit_into_play_no_out',
                    'hit_into_play_score'
                )) AS swings,
                countIf(description LIKE 'called_strike%') AS called_strikes
            FROM pitches
            WHERE {col} = {{pid:UInt32}}
              AND game_year = {{season:UInt16}}
              AND game_type = 'R'
              AND plate_x IS NOT NULL
              AND plate_z IS NOT NULL
              AND plate_x BETWEEN -1.5 AND 1.5
              AND plate_z BETWEEN 1.0 AND 4.0
            GROUP BY x_bin, z_bin
            """,
            parameters={"pid": player_id, "season": season},
        )

        # Compute total pitches for zone_pct
        grand_total = sum(r[2] for r in result.result_rows) if result.result_rows else 0

        x_width = (1.5 - (-1.5)) / 7
        z_width = (4.0 - 1.0) / 7

        bins = []
        for (
            x_bin, z_bin, total, whiffs, swings, called_strikes,
        ) in result.result_rows:
            # Clamp bin indices to 0-6
            xi = max(0, min(6, int(x_bin)))
            zi = max(0, min(6, int(z_bin)))

            # Compute bin center
            center_x = round(-1.5 + (xi + 0.5) * x_width, 2)
            center_z = round(1.0 + (zi + 0.5) * z_width, 2)

            whiff_pct = round(safe_div(whiffs, swings) * 100, 1) if swings else None
            swing_pct = round(safe_div(swings, total) * 100, 1) if total else None
            cs_pct = round(safe_div(called_strikes, total) * 100, 1) if total else None
            zone_pct = round(safe_div(total, grand_total) * 100, 1) if grand_total else None

            bins.append(ZoneProfileBin(
                x=center_x,
                y=center_z,
                whiff_pct=whiff_pct,
                swing_pct=swing_pct,
                called_strike_pct=cs_pct,
                zone_pct=zone_pct,
                total=total,
            ))

        return ZoneProfileData(
            player_id=player_id,
            season=season,
            role=role,
            bins=bins,
        )
