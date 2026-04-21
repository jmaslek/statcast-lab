from litestar import Controller, get

from backend.db import Client
from backend.models.arsenal import ArsenalData, ArsenalRow, PitcherArsenalData
from backend.models.charts import (
    ArsenalComparisonData,
    LeagueAverageMovement,
    MovementPoint,
    PitcherMovementSet,
    PitchTypeSummary,
)
from backend.models.pitching import PitchingLeaderboard, PitchUsageByCountCell, PitchUsageByCountData
from backend.services.stats import get_pitching_leaderboard
from backend.utils import sort_and_limit

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
        desc: bool = True,
        offset: int = 0,
    ) -> PitchingLeaderboard:
        players, total = get_pitching_leaderboard(
            client, season, min_pitches, team, sort, limit, desc=desc, offset=offset
        )
        return PitchingLeaderboard(players=players, season=season, total=total)

    @get("/arsenal")
    async def arsenal_leaderboard(
        self,
        client: Client,
        season: int = 2025,
        sort: str = "whiff_pct",
        limit: int = 100,
        desc: bool = True,
        offset: int = 0,
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
        rows, total = sort_and_limit(rows, sort, _ARSENAL_SORT_COLS, desc, limit, offset=offset)
        return ArsenalData(rows=rows, season=season, total=total)

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

    @get("/compare-arsenal")
    async def compare_arsenal(
        self,
        client: Client,
        pitchers: str = "",
        season: int = 2026,
    ) -> ArsenalComparisonData:
        """Compare pitch arsenals of 2+ pitchers with movement overlay data."""
        pitcher_ids = [int(x) for x in pitchers.split(",") if x.strip()]
        if len(pitcher_ids) < 2:
            return ArsenalComparisonData(pitchers=[], league_averages=[], season=season)

        pitcher_sets: list[PitcherMovementSet] = []
        all_p_throws: set[str] = set()

        for pid in pitcher_ids:
            # Name lookup
            name_result = client.query(
                "SELECT name_full FROM players FINAL WHERE player_id = {pid:UInt32}",
                parameters={"pid": pid},
            )
            name = name_result.result_rows[0][0] if name_result.result_rows else "Unknown"

            # Movement points (pfx in inches)
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
                parameters={"pid": pid, "season": season},
            )
            points = [
                MovementPoint(
                    pfx_x=r[0], pfx_z=r[1],
                    pitch_type=r[2], pitch_name=r[3], release_speed=r[4],
                )
                for r in pitch_result.result_rows
            ]
            p_throws = pitch_result.result_rows[0][5] if pitch_result.result_rows else "R"
            all_p_throws.add(p_throws)

            # Pitch summary
            summary_result = client.query(
                """
                SELECT pitch_type, any(pitch_name), count(), avg(release_speed)
                FROM pitches
                WHERE pitcher = {pid:UInt32}
                  AND game_year = {season:UInt16}
                  AND pitch_type IS NOT NULL
                GROUP BY pitch_type
                """,
                parameters={"pid": pid, "season": season},
            )
            total = sum(r[2] for r in summary_result.result_rows)
            pitch_summary = [
                PitchTypeSummary(
                    pitch_type=r[0], pitch_name=r[1],
                    usage_pct=round(r[2] / total * 100, 1) if total else 0,
                    avg_speed=r[3], count=r[2], league_avg_speed=None,
                )
                for r in summary_result.result_rows
            ]

            pitcher_sets.append(PitcherMovementSet(
                pitcher_id=pid, name=name, p_throws=p_throws,
                points=points, pitch_summary=pitch_summary,
            ))

        # League averages (use first pitcher's handedness, or both if mixed)
        hand = list(all_p_throws)[0] if len(all_p_throws) == 1 else "R"
        league_result = client.query(
            """
            SELECT pitch_type, any(pitch_name),
                   avg(pfx_x * 12), avg(pfx_z * 12),
                   stddevPop(pfx_x * 12), stddevPop(pfx_z * 12),
                   count()
            FROM pitches
            WHERE game_year = {season:UInt16}
              AND p_throws = {hand:String}
              AND pfx_x IS NOT NULL AND pfx_z IS NOT NULL
              AND pitch_type IS NOT NULL
            GROUP BY pitch_type
            HAVING count() >= 100
            """,
            parameters={"season": season, "hand": hand},
        )
        league_avgs = [
            LeagueAverageMovement(
                pitch_type=r[0], pitch_name=r[1],
                avg_pfx_x=r[2], avg_pfx_z=r[3],
                std_pfx_x=r[4], std_pfx_z=r[5], count=r[6],
            )
            for r in league_result.result_rows
        ]

        return ArsenalComparisonData(
            pitchers=pitcher_sets, league_averages=league_avgs, season=season,
        )

    @get("/usage-by-count/{pitcher_id:int}")
    async def usage_by_count(
        self,
        client: Client,
        pitcher_id: int,
        season: int = 2026,
    ) -> PitchUsageByCountData:
        """Pitch type usage breakdown by count for a pitcher."""
        # Get pitcher name
        name_result = client.query(
            "SELECT name_full FROM players FINAL WHERE player_id = {pid:UInt32}",
            parameters={"pid": pitcher_id},
        )
        name = name_result.result_rows[0][0] if name_result.result_rows else "Unknown"

        result = client.query(
            """
            SELECT
                pitch_type,
                any(pitch_name) AS pitch_name,
                concat(toString(balls), '-', toString(strikes)) AS count_state,
                count() AS num_pitches,
                avg(release_speed) AS avg_velo,
                countIf(description IN (
                    'swinging_strike', 'swinging_strike_blocked', 'foul_tip'
                )) AS whiffs,
                countIf(description IN (
                    'swinging_strike', 'swinging_strike_blocked', 'foul',
                    'foul_tip', 'hit_into_play', 'hit_into_play_no_out',
                    'hit_into_play_score'
                )) AS swings
            FROM pitches
            WHERE pitcher = {pid:UInt32}
              AND game_year = {season:UInt16}
              AND pitch_type IS NOT NULL
              AND game_type = 'R'
            GROUP BY pitch_type, count_state
            ORDER BY pitch_type, count_state
            """,
            parameters={"pid": pitcher_id, "season": season},
        )

        # Compute totals per count state for usage %
        count_totals: dict[str, int] = {}
        for row in result.result_rows:
            _pt, _pn, cs, n, *_ = row
            count_totals[cs] = count_totals.get(cs, 0) + n

        # Compute overall pitch type order by total usage
        type_totals: dict[str, int] = {}
        type_names: dict[str, str] = {}
        for row in result.result_rows:
            pt, pn, _cs, n, *_ = row
            type_totals[pt] = type_totals.get(pt, 0) + n
            if pn:
                type_names[pt] = pn

        pitch_types = sorted(type_totals, key=lambda t: type_totals[t], reverse=True)

        # Standard count order
        all_counts = [
            "0-0", "0-1", "0-2",
            "1-0", "1-1", "1-2",
            "2-0", "2-1", "2-2",
            "3-0", "3-1", "3-2",
        ]
        counts = [c for c in all_counts if c in count_totals]

        cells = []
        for row in result.result_rows:
            pt, pn, cs, n, avg_velo, whiffs, swings = row
            total = count_totals.get(cs, 0)
            cells.append(PitchUsageByCountCell(
                pitch_type=pt,
                pitch_name=pn,
                count_state=cs,
                usage_pct=round(n / total * 100, 1) if total else 0,
                num_pitches=n,
                avg_velo=round(avg_velo, 1) if avg_velo else None,
                whiff_pct=round(whiffs / swings * 100, 1) if swings else None,
            ))

        return PitchUsageByCountData(
            pitcher_id=pitcher_id,
            name=name,
            season=season,
            pitch_types=pitch_types,
            pitch_names=type_names,
            counts=counts,
            cells=cells,
        )
