from pydantic import BaseModel


class PlayerSummary(BaseModel):
    player_id: int
    name_full: str
    position: str
    team: str


class PlayerSearchResult(BaseModel):
    results: list[PlayerSummary]
    total: int


class PlayerHittingStats(BaseModel):
    pa: int
    ab: int
    hits: int
    singles: int
    doubles: int
    triples: int
    home_runs: int
    walks: int
    strikeouts: int
    hbp: int
    sac_flies: int
    total_bases: int
    avg: float
    obp: float
    slg: float
    avg_exit_velo: float | None
    avg_launch_angle: float | None
    barrel_pct: float
    hard_hit_pct: float


class PlayerPitchingStats(BaseModel):
    total_pitches: int
    batters_faced: int
    strikeouts: int
    walks: int
    hits_allowed: int
    home_runs_allowed: int
    avg_velo: float | None
    avg_spin: float | None
    avg_extension: float | None
    k_pct: float
    bb_pct: float
    whiff_pct: float
    csw_pct: float


class PlayerSeasonStats(BaseModel):
    player_id: int
    season: int
    hitting: PlayerHittingStats | None = None
    pitching: PlayerPitchingStats | None = None


class CareerStatcastRow(BaseModel):
    season: int
    pa: int
    pitches: int
    barrel_pct: float | None
    barrel_pa_pct: float | None
    exit_velo: float | None
    max_ev: float | None
    launch_angle: float | None
    sweet_spot_pct: float | None
    hard_hit_pct: float | None
    xba: float | None
    xslg: float | None
    xwoba: float | None
    k_pct: float | None
    bb_pct: float | None
    avg: float | None
    slg: float | None
    woba: float | None


class CareerStatcastData(BaseModel):
    player_id: int
    rows: list[CareerStatcastRow]


class CareerPitchingRow(BaseModel):
    season: int
    pitches: int
    batters_faced: int
    avg_velo: float | None
    max_velo: float | None
    avg_spin: float | None
    extension: float | None
    k_pct: float | None
    bb_pct: float | None
    whiff_pct: float | None
    csw_pct: float | None
    hard_hit_pct: float | None
    barrel_pct: float | None
    xba: float | None
    xwoba: float | None


class CareerPitchingData(BaseModel):
    player_id: int
    rows: list[CareerPitchingRow]


class PercentileStat(BaseModel):
    stat_name: str
    stat_value: float
    percentile: int


class PlayerPercentiles(BaseModel):
    player_id: int
    season: int
    batting: list[PercentileStat]
    pitching: list[PercentileStat]


# ---- Game Log models ----


class GameLogHittingRow(BaseModel):
    game_date: str
    opponent: str
    pa: int
    ab: int
    hits: int
    doubles: int
    triples: int
    home_runs: int
    walks: int
    strikeouts: int
    avg: float
    obp: float
    slg: float


class GameLogPitchingRow(BaseModel):
    game_date: str
    opponent: str
    ip: str  # "6.2" format
    hits_allowed: int
    runs: int
    earned_runs: int
    walks: int
    strikeouts: int
    pitches: int
    whiff_pct: float | None


class GameLogData(BaseModel):
    player_id: int
    season: int
    hitting: list[GameLogHittingRow]
    pitching: list[GameLogPitchingRow]


# ---- Trending models ----


class TrendingPlayerRow(BaseModel):
    player_id: int
    name: str
    team: str
    season_pa: int
    season_ops: float
    recent_pa: int
    recent_ops: float
    ops_delta: float
    recent_avg: float
    recent_hr: int


class TrendingPlayersData(BaseModel):
    hot: list[TrendingPlayerRow]
    cold: list[TrendingPlayerRow]
    season: int
    days: int
