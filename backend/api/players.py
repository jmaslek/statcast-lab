from litestar import Controller, get

from backend.db import Client
from backend.models.charts import RollingDataPoint, RollingStatsData
from backend.models.players import (
    CareerPitchingData,
    CareerPitchingRow,
    CareerStatcastData,
    CareerStatcastRow,
    GameLogData,
    GameLogHittingRow,
    GameLogPitchingRow,
    PercentileStat,
    PlayerHittingStats,
    PlayerPercentiles,
    PlayerPitchingStats,
    PlayerSearchResult,
    PlayerSeasonStats,
    PlayerSummary,
    TrendingPlayerRow,
    TrendingPlayersData,
)
from backend.utils import safe_div, safe_pct

# Stat definitions: (sql_numerator, sql_denominator, is_rate)
# For rate stats, rolling value = sum(numerator) / sum(denominator)
# For counting stats, rolling value = sum(numerator)
_ROLLING_STATS: dict[str, tuple[str, str | None, bool]] = {
    "avg": (
        "countIf(events IN ('single','double','triple','home_run'))",
        "countIf(events IS NOT NULL AND events NOT IN ('walk','hit_by_pitch','sac_fly','sac_bunt','catcher_interf'))",
        True,
    ),
    "obp": (
        "countIf(events IN ('single','double','triple','home_run','walk','hit_by_pitch'))",
        "countIf(events IS NOT NULL AND events NOT IN ('sac_bunt','catcher_interf'))",
        True,
    ),
    "slg": (
        "countIf(events='single') + 2*countIf(events='double') + 3*countIf(events='triple') + 4*countIf(events='home_run')",
        "countIf(events IS NOT NULL AND events NOT IN ('walk','hit_by_pitch','sac_fly','sac_bunt','catcher_interf'))",
        True,
    ),
    "barrel_pct": (
        "countIf(barrel = 1)",
        "countIf(launch_speed IS NOT NULL)",
        True,
    ),
    "hard_hit_pct": (
        "countIf(launch_speed >= 95)",
        "countIf(launch_speed IS NOT NULL)",
        True,
    ),
    "k_pct": (
        "countIf(events IN ('strikeout','strikeout_double_play'))",
        "countIf(events IS NOT NULL)",
        True,
    ),
    "bb_pct": (
        "countIf(events = 'walk')",
        "countIf(events IS NOT NULL)",
        True,
    ),
    "whiff_pct": (
        "countIf(description IN ('swinging_strike','swinging_strike_blocked','foul_tip'))",
        "countIf(description IN ('swinging_strike','swinging_strike_blocked','foul','foul_tip','hit_into_play','hit_into_play_no_out','hit_into_play_score'))",
        True,
    ),
}


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

    @get("/{player_id:int}/career-hitting")
    async def career_hitting(
        self, client: Client, player_id: int,
    ) -> CareerStatcastData:
        """Year-by-year Statcast hitting stats across all available seasons."""
        result = client.query(
            """
            SELECT
                game_year,
                countIf(events IS NOT NULL) AS pa,
                count() AS pitches,
                countIf(barrel = 1) AS barrels,
                countIf(launch_speed IS NOT NULL) AS bbe,
                avgIf(launch_speed, launch_speed IS NOT NULL) AS avg_ev,
                maxIf(launch_speed, launch_speed IS NOT NULL) AS max_ev,
                avgIf(launch_angle, launch_angle IS NOT NULL) AS avg_la,
                countIf(launch_angle BETWEEN 8 AND 32) AS sweet_spots,
                countIf(launch_speed >= 95) AS hard_hits,
                avgIf(estimated_ba_using_speedangle,
                      estimated_ba_using_speedangle IS NOT NULL) AS xba,
                avgIf(estimated_slg_using_speedangle,
                      estimated_slg_using_speedangle IS NOT NULL) AS xslg,
                avgIf(estimated_woba_using_speedangle,
                      estimated_woba_using_speedangle IS NOT NULL) AS xwoba,
                countIf(events IN ('strikeout','strikeout_double_play')) AS ks,
                countIf(events = 'walk') AS bbs,
                countIf(events IN ('single','double','triple','home_run')) AS hits,
                countIf(events IS NOT NULL
                    AND events NOT IN ('walk','hit_by_pitch','sac_fly','sac_bunt','catcher_interf')
                ) AS ab,
                countIf(events='single') + 2*countIf(events='double')
                    + 3*countIf(events='triple') + 4*countIf(events='home_run') AS tb,
                sumIf(woba_value, woba_denom = 1) AS woba_num,
                countIf(woba_denom = 1) AS woba_den
            FROM pitches
            WHERE batter = {pid:UInt32}
              AND game_type = 'R'
            GROUP BY game_year
            HAVING pa >= 10
            ORDER BY game_year
            """,
            parameters={"pid": player_id},
        )

        rows = []
        for r in result.result_rows:
            (
                season, pa, pitches, barrels, bbe, avg_ev, max_ev, avg_la,
                sweet_spots, hard_hits, xba, xslg, xwoba, ks, bbs,
                hits, ab, tb, woba_num, woba_den,
            ) = r
            rows.append(CareerStatcastRow(
                season=season,
                pa=pa,
                pitches=pitches,
                barrel_pct=round(barrels / bbe * 100, 1) if bbe else None,
                barrel_pa_pct=round(barrels / pa * 100, 1) if pa else None,
                exit_velo=round(avg_ev, 1) if avg_ev else None,
                max_ev=round(max_ev, 1) if max_ev else None,
                launch_angle=round(avg_la, 1) if avg_la else None,
                sweet_spot_pct=round(sweet_spots / bbe * 100, 1) if bbe else None,
                hard_hit_pct=round(hard_hits / bbe * 100, 1) if bbe else None,
                xba=round(xba, 3) if xba else None,
                xslg=round(xslg, 3) if xslg else None,
                xwoba=round(xwoba, 3) if xwoba else None,
                k_pct=round(ks / pa * 100, 1) if pa else None,
                bb_pct=round(bbs / pa * 100, 1) if pa else None,
                avg=round(safe_div(hits, ab), 3) if ab else None,
                slg=round(safe_div(tb, ab), 3) if ab else None,
                woba=round(safe_div(woba_num, woba_den), 3) if woba_den else None,
            ))

        return CareerStatcastData(player_id=player_id, rows=rows)

    @get("/{player_id:int}/career-pitching")
    async def career_pitching(
        self, client: Client, player_id: int,
    ) -> CareerPitchingData:
        """Year-by-year Statcast pitching stats across all available seasons."""
        result = client.query(
            """
            SELECT
                game_year,
                count() AS pitches,
                countIf(events IS NOT NULL) AS bf,
                avg(release_speed) AS avg_velo,
                max(release_speed) AS max_velo,
                avg(release_spin_rate) AS avg_spin,
                avg(release_extension) AS extension,
                countIf(events IN ('strikeout','strikeout_double_play')) AS ks,
                countIf(events = 'walk') AS bbs,
                countIf(description IN (
                    'swinging_strike','swinging_strike_blocked','foul_tip'
                )) AS whiffs,
                countIf(description LIKE 'called_strike%') AS called_strikes,
                countIf(description IN (
                    'swinging_strike','swinging_strike_blocked','foul',
                    'foul_tip','hit_into_play','hit_into_play_no_out',
                    'hit_into_play_score'
                )) AS swings,
                countIf(launch_speed >= 95) AS hard_hits,
                countIf(launch_speed IS NOT NULL) AS bbe,
                countIf(barrel = 1) AS barrels,
                avgIf(estimated_ba_using_speedangle,
                      estimated_ba_using_speedangle IS NOT NULL) AS xba,
                avgIf(estimated_woba_using_speedangle,
                      estimated_woba_using_speedangle IS NOT NULL) AS xwoba
            FROM pitches
            WHERE pitcher = {pid:UInt32}
              AND game_type = 'R'
            GROUP BY game_year
            HAVING bf >= 10
            ORDER BY game_year
            """,
            parameters={"pid": player_id},
        )

        rows = []
        for r in result.result_rows:
            (
                season, pitches, bf, avg_velo, max_velo, avg_spin, extension,
                ks, bbs, whiffs, called_strikes, swings,
                hard_hits, bbe, barrels, xba, xwoba,
            ) = r
            rows.append(CareerPitchingRow(
                season=season,
                pitches=pitches,
                batters_faced=bf,
                avg_velo=round(avg_velo, 1) if avg_velo else None,
                max_velo=round(max_velo, 1) if max_velo else None,
                avg_spin=round(avg_spin) if avg_spin else None,
                extension=round(extension, 1) if extension else None,
                k_pct=round(ks / bf * 100, 1) if bf else None,
                bb_pct=round(bbs / bf * 100, 1) if bf else None,
                whiff_pct=round(safe_div(whiffs, swings) * 100, 1) if swings else None,
                csw_pct=round(safe_div(called_strikes + whiffs, pitches) * 100, 1) if pitches else None,
                hard_hit_pct=round(safe_div(hard_hits, bbe) * 100, 1) if bbe else None,
                barrel_pct=round(safe_div(barrels, bbe) * 100, 1) if bbe else None,
                xba=round(xba, 3) if xba else None,
                xwoba=round(xwoba, 3) if xwoba else None,
            ))

        return CareerPitchingData(player_id=player_id, rows=rows)

    @get("/{player_id:int}/rolling")
    async def rolling_stats(
        self,
        client: Client,
        player_id: int,
        stat: str = "avg",
        season: int = 2026,
        window: int = 30,
    ) -> RollingStatsData:
        """Compute rolling stats over a game-day window from raw pitch data."""
        if stat not in _ROLLING_STATS:
            return RollingStatsData(
                player_id=player_id, season=season, stat=stat,
                window=window, league_avg=None, data=[],
            )

        numerator_sql, denominator_sql, is_rate = _ROLLING_STATS[stat]

        # Determine if this is a batter or pitcher stat
        pitcher_stats = {"whiff_pct"}
        col = "pitcher" if stat in pitcher_stats else "batter"

        # Daily aggregates for the player
        daily_result = client.query(
            f"""
            SELECT game_date,
                   {numerator_sql} AS numer,
                   {denominator_sql or '1'} AS denom
            FROM pitches
            WHERE {col} = {{pid:UInt32}}
              AND game_year = {{season:UInt16}}
              AND game_type = 'R'
            GROUP BY game_date
            ORDER BY game_date
            """,
            parameters={"pid": player_id, "season": season},
        )

        if not daily_result.result_rows:
            return RollingStatsData(
                player_id=player_id, season=season, stat=stat,
                window=window, league_avg=None, data=[],
            )

        # Compute rolling window
        dates = [r[0] for r in daily_result.result_rows]
        numers = [r[1] for r in daily_result.result_rows]
        denoms = [r[2] for r in daily_result.result_rows]

        data_points: list[RollingDataPoint] = []
        for i, d in enumerate(dates):
            # Collect all days within the window
            cum_n, cum_d = 0, 0
            for j in range(i, -1, -1):
                if (d - dates[j]).days >= window:
                    break
                cum_n += numers[j]
                cum_d += denoms[j]

            if cum_d > 0 and is_rate:
                value = round(cum_n / cum_d, 3)
            else:
                value = cum_n

            data_points.append(RollingDataPoint(
                date=d.isoformat(), value=value, sample=cum_d,
            ))

        # League average for reference
        league_result = client.query(
            f"""
            SELECT {numerator_sql} AS numer, {denominator_sql or '1'} AS denom
            FROM pitches
            WHERE game_year = {{season:UInt16}} AND game_type = 'R'
            """,
            parameters={"season": season},
        )
        league_avg = None
        if league_result.result_rows and is_rate:
            ln, ld = league_result.result_rows[0]
            if ld > 0:
                league_avg = round(ln / ld, 3)

        return RollingStatsData(
            player_id=player_id, season=season, stat=stat,
            window=window, league_avg=league_avg, data=data_points,
        )

    @get("/{player_id:int}/percentiles")
    async def get_percentiles(
        self, client: Client, player_id: int, season: int = 2026,
    ) -> PlayerPercentiles:
        """Get percentile ranks for a player."""
        result = client.query(
            """
            SELECT player_type, stat_name, stat_value, percentile
            FROM player_percentiles FINAL
            WHERE player_id = {pid:UInt32} AND season = {season:UInt16}
            ORDER BY player_type, stat_name
            """,
            parameters={"pid": player_id, "season": season},
        )

        batting: list[PercentileStat] = []
        pitching: list[PercentileStat] = []
        for player_type, stat_name, stat_value, percentile in result.result_rows:
            stat = PercentileStat(
                stat_name=stat_name,
                stat_value=round(stat_value, 1),
                percentile=percentile,
            )
            if player_type == "batter":
                batting.append(stat)
            else:
                pitching.append(stat)

        return PlayerPercentiles(
            player_id=player_id, season=season,
            batting=batting, pitching=pitching,
        )

    @get("/{player_id:int}/game-log")
    async def game_log(
        self, client: Client, player_id: int, season: int = 2026,
    ) -> GameLogData:
        """Per-game hitting and pitching stats."""

        # Hitting game log
        hitting_result = client.query(
            """
            SELECT
                game_date,
                CASE WHEN any(inning_topbot) = 'Bot' THEN any(away_team) ELSE any(home_team) END AS opponent,
                countIf(events IS NOT NULL) AS pa,
                countIf(events IS NOT NULL
                    AND events NOT IN ('walk','hit_by_pitch','sac_fly','sac_bunt','catcher_interf')
                ) AS ab,
                countIf(events IN ('single','double','triple','home_run')) AS hits,
                countIf(events = 'double') AS doubles,
                countIf(events = 'triple') AS triples,
                countIf(events = 'home_run') AS home_runs,
                countIf(events = 'walk') AS walks,
                countIf(events IN ('strikeout','strikeout_double_play')) AS strikeouts,
                countIf(events='single') + 2*countIf(events='double')
                    + 3*countIf(events='triple') + 4*countIf(events='home_run') AS total_bases,
                countIf(events IN ('single','double','triple','home_run','walk','hit_by_pitch')) AS on_base,
                countIf(events IS NOT NULL
                    AND events NOT IN ('sac_bunt','catcher_interf')
                ) AS obp_denom
            FROM pitches
            WHERE batter = {pid:UInt32}
              AND game_year = {season:UInt16}
              AND game_type = 'R'
            GROUP BY game_date, game_pk
            HAVING pa > 0
            ORDER BY game_date
            """,
            parameters={"pid": player_id, "season": season},
        )

        hitting_rows = []
        for (
            game_date, opponent, pa, ab, hits, doubles, triples, home_runs,
            walks, strikeouts, total_bases, on_base, obp_denom,
        ) in hitting_result.result_rows:
            avg = round(safe_div(hits, ab), 3)
            obp = round(safe_div(on_base, obp_denom), 3)
            slg = round(safe_div(total_bases, ab), 3)
            hitting_rows.append(GameLogHittingRow(
                game_date=game_date.isoformat(),
                opponent=opponent,
                pa=pa, ab=ab, hits=hits,
                doubles=doubles, triples=triples, home_runs=home_runs,
                walks=walks, strikeouts=strikeouts,
                avg=avg, obp=obp, slg=slg,
            ))

        # Pitching game log
        pitching_result = client.query(
            """
            SELECT
                game_date,
                CASE WHEN any(inning_topbot) = 'Top' THEN any(away_team) ELSE any(home_team) END AS opponent,
                countIf(events IS NOT NULL AND events NOT IN (
                    'walk','hit_by_pitch','sac_fly','sac_bunt',
                    'catcher_interf','single','double','triple',
                    'home_run','field_error','fielders_choice',
                    'fielders_choice_out'
                ) AND events NOT LIKE '%interference%') AS outs_recorded,
                countIf(events IN ('single','double','triple','home_run')) AS hits_allowed,
                countIf(events IN ('strikeout','strikeout_double_play')) AS strikeouts,
                countIf(events = 'walk') AS walks,
                count() AS pitches,
                countIf(description IN (
                    'swinging_strike','swinging_strike_blocked','foul_tip'
                )) AS whiffs,
                countIf(description IN (
                    'swinging_strike','swinging_strike_blocked','foul',
                    'foul_tip','hit_into_play','hit_into_play_no_out',
                    'hit_into_play_score'
                )) AS swings
            FROM pitches
            WHERE pitcher = {pid:UInt32}
              AND game_year = {season:UInt16}
              AND game_type = 'R'
            GROUP BY game_date, game_pk
            HAVING pitches > 0
            ORDER BY game_date
            """,
            parameters={"pid": player_id, "season": season},
        )

        pitching_rows = []
        for (
            game_date, opponent, outs_recorded, hits_allowed,
            strikeouts, walks, pitches, whiffs, swings,
        ) in pitching_result.result_rows:
            full_innings = outs_recorded // 3
            remainder = outs_recorded % 3
            ip = f"{full_innings}.{remainder}"
            whiff_pct = round(safe_div(whiffs, swings) * 100, 1) if swings else None

            pitching_rows.append(GameLogPitchingRow(
                game_date=game_date.isoformat(),
                opponent=opponent,
                ip=ip,
                hits_allowed=hits_allowed,
                runs=0,  # Not reliably computable from pitch-level data
                earned_runs=0,
                walks=walks,
                strikeouts=strikeouts,
                pitches=pitches,
                whiff_pct=whiff_pct,
            ))

        return GameLogData(
            player_id=player_id,
            season=season,
            hitting=hitting_rows,
            pitching=pitching_rows,
        )

    @get("/trending")
    async def trending_players(
        self, client: Client, season: int = 2026, days: int = 14,
    ) -> TrendingPlayersData:
        """Compute recent vs full-season performance for batters."""

        # Recent stats from pitches table
        recent_result = client.query(
            """
            SELECT
                batter,
                countIf(events IS NOT NULL) AS pa,
                countIf(events IN ('single','double','triple','home_run')) AS hits,
                countIf(events IS NOT NULL
                    AND events NOT IN ('walk','hit_by_pitch','sac_fly','sac_bunt','catcher_interf')
                ) AS ab,
                countIf(events IN ('single','double','triple','home_run','walk','hit_by_pitch')) AS on_base,
                countIf(events IS NOT NULL
                    AND events NOT IN ('sac_bunt','catcher_interf')
                ) AS obp_denom,
                countIf(events='single') + 2*countIf(events='double')
                    + 3*countIf(events='triple') + 4*countIf(events='home_run') AS total_bases,
                countIf(events = 'home_run') AS hr
            FROM pitches
            WHERE game_year = {season:UInt16}
              AND game_type = 'R'
              AND game_date >= today() - {days:UInt32}
            GROUP BY batter
            HAVING pa >= 5
            """,
            parameters={"season": season, "days": days},
        )

        # Build recent stats lookup
        recent_map: dict[int, dict] = {}
        for (
            batter, pa, hits, ab, on_base, obp_denom, total_bases, hr,
        ) in recent_result.result_rows:
            avg = round(safe_div(hits, ab), 3)
            obp = round(safe_div(on_base, obp_denom), 3)
            slg = round(safe_div(total_bases, ab), 3)
            recent_map[batter] = {
                "pa": pa, "avg": avg, "obp": obp, "slg": slg,
                "ops": round(obp + slg, 3), "hr": hr,
            }

        # Season totals from materialized view
        season_result = client.query(
            """
            SELECT
                h.batter,
                p.name_full,
                p.team,
                h.pa,
                h.ab,
                h.hits,
                h.walks,
                h.hbp,
                h.sac_flies,
                h.total_bases
            FROM player_season_hitting AS h FINAL
            JOIN players AS p FINAL ON h.batter = p.player_id
            WHERE h.season = {season:UInt16}
              AND h.pa >= 20
            """,
            parameters={"season": season},
        )

        rows = []
        for (
            batter, name, team, pa, ab, hits, walks, hbp, sf, total_bases,
        ) in season_result.result_rows:
            if batter not in recent_map:
                continue
            obp_denom = ab + walks + hbp + sf
            season_obp = round(safe_div(hits + walks + hbp, obp_denom), 3)
            season_slg = round(safe_div(total_bases, ab), 3)
            season_ops = round(season_obp + season_slg, 3)

            recent = recent_map[batter]
            ops_delta = round(recent["ops"] - season_ops, 3)

            rows.append(TrendingPlayerRow(
                player_id=batter,
                name=name,
                team=team,
                season_pa=pa,
                season_ops=season_ops,
                recent_pa=recent["pa"],
                recent_ops=recent["ops"],
                ops_delta=ops_delta,
                recent_avg=recent["avg"],
                recent_hr=recent["hr"],
            ))

        # Sort by ops_delta descending for hot, ascending for cold
        rows.sort(key=lambda r: r.ops_delta, reverse=True)
        hot = rows[:10]

        rows.sort(key=lambda r: r.ops_delta)
        cold = rows[:10]

        return TrendingPlayersData(
            hot=hot, cold=cold, season=season, days=days,
        )
