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
    woba: float | None
    wrc_plus: float | None


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


class BaserunningRow(BaseModel):
    player_id: int
    name: str
    sb: int
    cs: int
    sb_pct: float
    sb_2b: int
    sb_3b: int
    sb_home: int
    pickoffs: int
    wp_advances: int
    pb_advances: int
    br_runs: float


class BaserunningLeaderboard(BaseModel):
    players: list[BaserunningRow]
    season: int
    total: int


class PitcherBaserunningRow(BaseModel):
    player_id: int
    name: str
    sb_against: int
    cs_by: int
    sb_pct_against: float
    wp: int
    balk: int
    pickoff_attempts: int
    pickoff_outs: int


class PitcherBaserunningLeaderboard(BaseModel):
    players: list[PitcherBaserunningRow]
    season: int
    total: int


class AbsChallengeRow(BaseModel):
    name: str
    team: str
    challenges: int
    overturns: int
    confirms: int
    overturn_pct: float
    k_flips: int
    bb_flips: int


class AbsLeaderboard(BaseModel):
    rows: list[AbsChallengeRow]
    season: int
    challenge_type: str
    total: int


class AbsChallengeEvent(BaseModel):
    game_pk: int
    play_id: str
    game_date: str
    inning: int
    outs: int
    count: str
    batter_name: str
    pitcher_name: str
    catcher_name: str
    bat_team: str
    fld_team: str
    plate_x: float
    plate_z: float
    sz_top: float
    sz_bot: float
    original_call: str
    result: str
    is_overturned: bool
    edge_dist: float


class AbsChallengeEventList(BaseModel):
    events: list[AbsChallengeEvent]
    entity_name: str
    season: int
    total: int


# ---- Bat Tracking models ----


class BatTrackingRow(BaseModel):
    player_id: int
    name: str
    swings: int
    avg_bat_speed: float
    max_bat_speed: float
    avg_swing_length: float | None
    fast_swing_rate: float  # % of swings >= 75 mph
    avg_barrel_bat_speed: float | None


class BatTrackingLeaderboard(BaseModel):
    players: list[BatTrackingRow]
    season: int
    total: int
