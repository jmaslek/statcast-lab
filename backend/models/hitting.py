from pydantic import BaseModel


class HittingLeaderRow(BaseModel):
    player_id: int
    name: str
    pa: int
    ab: int
    hits: int
    home_runs: int
    walks: int
    strikeouts: int
    avg: float  # batting average = hits / ab
    obp: float  # on-base pct = (hits + walks + hbp) / (ab + walks + hbp + sf)
    slg: float  # slugging = total_bases / ab
    ops: float  # obp + slg
    barrel_pct: float  # barrel_count / batted_ball_events
    avg_exit_velo: float
    hard_hit_pct: float  # hard_hit_count / batted_ball_events
    xba: float | None
    xwoba: float | None


class HittingLeaderboard(BaseModel):
    players: list[HittingLeaderRow]
    season: int
    total: int


class ExpectedStatsRow(BaseModel):
    player_id: int
    name: str
    pa: int
    ba: float
    xba: float
    ba_diff: float
    woba: float | None
    xwoba: float
    woba_diff: float | None


class ExpectedStatsLeaderboard(BaseModel):
    players: list[ExpectedStatsRow]
    season: int
    total: int


class BattedBallRow(BaseModel):
    player_id: int
    name: str
    bbe: int
    gb_pct: float
    fb_pct: float
    ld_pct: float
    popup_pct: float
    pull_pct: float
    center_pct: float
    oppo_pct: float
    sweet_spot_pct: float
    barrel_pct: float
    hard_hit_pct: float
    avg_la: float
    avg_ev: float
    max_ev: float


class BattedBallLeaderboard(BaseModel):
    players: list[BattedBallRow]
    season: int
    total: int


class PlatoonRow(BaseModel):
    player_id: int
    name: str
    pa_vl: int
    avg_vl: float
    obp_vl: float
    slg_vl: float
    ops_vl: float
    k_pct_vl: float
    xwoba_vl: float | None
    pa_vr: int
    avg_vr: float
    obp_vr: float
    slg_vr: float
    ops_vr: float
    k_pct_vr: float
    xwoba_vr: float | None
    ops_diff: float


class PlatoonLeaderboard(BaseModel):
    players: list[PlatoonRow]
    season: int
    total: int
