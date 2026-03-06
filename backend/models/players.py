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
