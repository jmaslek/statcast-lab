"""Service module for querying ClickHouse and computing derived stats."""

from backend.db import Client
from backend.models.hitting import HittingLeaderRow
from backend.models.pitching import PitchingLeaderRow
from backend.utils import safe_div

_HITTING_SORT_COLS = {
    "avg",
    "obp",
    "slg",
    "ops",
    "barrel_pct",
    "hard_hit_pct",
    "avg_exit_velo",
    "pa",
    "ab",
    "hits",
    "home_runs",
    "walks",
    "strikeouts",
    "xba",
    "xwoba",
}

_PITCHING_SORT_COLS = {
    "k_pct",
    "bb_pct",
    "whiff_pct",
    "csw_pct",
    "avg_velo",
    "avg_spin",
    "total_pitches",
    "batters_faced",
    "strikeouts",
    "walks",
    "hits_allowed",
    "home_runs_allowed",
}


def get_hitting_leaderboard(
    client: Client,
    season: int,
    min_pa: int = 50,
    team: str | None = None,
    sort: str = "ops",
    limit: int = 50,
) -> list[HittingLeaderRow]:
    """Query player_season_hitting and compute derived batting stats."""
    team_filter = ""
    params: dict = {
        "season": season,
        "min_pa": min_pa,
    }

    if team:
        team_filter = "AND p.team = {team:String}"
        params["team"] = team

    query = f"""
        SELECT
            h.batter AS player_id,
            p.name_full AS name,
            h.pa, h.ab, h.hits, h.home_runs, h.walks, h.strikeouts,
            h.launch_speed_sum, h.launch_speed_count,
            h.barrel_count, h.batted_ball_events, h.hard_hit_count,
            h.singles, h.doubles, h.triples, h.hbp, h.sac_flies, h.total_bases,
            h.xba_sum, h.xba_count, h.xwoba_sum, h.xwoba_count
        FROM player_season_hitting AS h FINAL
        JOIN players AS p FINAL ON h.batter = p.player_id
        WHERE h.season = {{season:UInt16}}
          AND h.pa >= {{min_pa:UInt64}}
          {team_filter}
    """

    result = client.query(query, parameters=params)

    players = []
    for row in result.result_rows:
        (
            player_id,
            name,
            pa,
            ab,
            hits,
            home_runs,
            walks,
            strikeouts,
            launch_speed_sum,
            launch_speed_count,
            barrel_count,
            batted_ball_events,
            hard_hit_count,
            singles,
            doubles,
            triples,
            hbp,
            sac_flies,
            total_bases,
            xba_sum,
            xba_count,
            xwoba_sum,
            xwoba_count,
        ) = row

        avg = safe_div(hits, ab)
        obp = safe_div(hits + walks + hbp, ab + walks + hbp + sac_flies)
        slg = safe_div(total_bases, ab)
        ops = obp + slg
        barrel_pct = safe_div(barrel_count, batted_ball_events) * 100
        hard_hit_pct = safe_div(hard_hit_count, batted_ball_events) * 100
        avg_exit_velo = safe_div(launch_speed_sum, launch_speed_count)

        xba = round(safe_div(xba_sum, xba_count), 3) if xba_count else None
        xwoba = round(safe_div(xwoba_sum, xwoba_count), 3) if xwoba_count else None

        players.append(
            HittingLeaderRow(
                player_id=player_id,
                name=name,
                pa=pa,
                ab=ab,
                hits=hits,
                home_runs=home_runs,
                walks=walks,
                strikeouts=strikeouts,
                avg=round(avg, 3),
                obp=round(obp, 3),
                slg=round(slg, 3),
                ops=round(ops, 3),
                barrel_pct=round(barrel_pct, 1),
                avg_exit_velo=round(avg_exit_velo, 1),
                hard_hit_pct=round(hard_hit_pct, 1),
                xba=xba,
                xwoba=xwoba,
            )
        )

    if sort in _HITTING_SORT_COLS:
        players.sort(key=lambda p: getattr(p, sort), reverse=True)

    return players[:limit]


def get_pitching_leaderboard(
    client: Client,
    season: int,
    min_pitches: int = 100,
    team: str | None = None,
    sort: str = "k_pct",
    limit: int = 50,
) -> list[PitchingLeaderRow]:
    """Query player_season_pitching and compute derived pitching stats."""
    team_filter = ""
    params: dict = {
        "season": season,
        "min_pitches": min_pitches,
    }

    if team:
        team_filter = "AND p.team = {team:String}"
        params["team"] = team

    query = f"""
        SELECT
            pt.pitcher AS player_id,
            p.name_full AS name,
            pt.total_pitches,
            pt.batters_faced,
            pt.strikeouts,
            pt.walks,
            pt.hits_allowed,
            pt.home_runs_allowed,
            pt.release_speed_sum, pt.release_speed_count,
            pt.spin_rate_sum, pt.spin_rate_count,
            pt.whiffs,
            pt.called_strikes,
            pt.swings
        FROM player_season_pitching AS pt FINAL
        JOIN players AS p FINAL ON pt.pitcher = p.player_id
        WHERE pt.season = {{season:UInt16}}
          AND pt.total_pitches >= {{min_pitches:UInt64}}
          {team_filter}
    """

    result = client.query(query, parameters=params)

    players = []
    for row in result.result_rows:
        (
            player_id,
            name,
            total_pitches,
            batters_faced,
            strikeouts,
            walks,
            hits_allowed,
            home_runs_allowed,
            release_speed_sum,
            release_speed_count,
            spin_rate_sum,
            spin_rate_count,
            whiffs,
            called_strikes,
            swings,
        ) = row

        k_pct = safe_div(strikeouts, batters_faced) * 100
        bb_pct = safe_div(walks, batters_faced) * 100
        whiff_pct = safe_div(whiffs, swings) * 100
        csw_pct = safe_div(called_strikes + whiffs, total_pitches) * 100
        avg_velo = safe_div(release_speed_sum, release_speed_count)
        avg_spin = safe_div(spin_rate_sum, spin_rate_count)

        players.append(
            PitchingLeaderRow(
                player_id=player_id,
                name=name,
                total_pitches=total_pitches,
                batters_faced=batters_faced,
                strikeouts=strikeouts,
                walks=walks,
                hits_allowed=hits_allowed,
                home_runs_allowed=home_runs_allowed,
                k_pct=round(k_pct, 1),
                bb_pct=round(bb_pct, 1),
                whiff_pct=round(whiff_pct, 1),
                csw_pct=round(csw_pct, 1),
                avg_velo=round(avg_velo, 1),
                avg_spin=round(avg_spin, 0),
            )
        )

    if sort in _PITCHING_SORT_COLS:
        players.sort(key=lambda p: getattr(p, sort), reverse=True)

    return players[:limit]
