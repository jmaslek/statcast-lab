from pydantic import BaseModel


class PitchingLeaderRow(BaseModel):
    player_id: int
    name: str
    total_pitches: int
    batters_faced: int
    strikeouts: int
    walks: int
    hits_allowed: int
    home_runs_allowed: int
    k_pct: float  # strikeouts / batters_faced
    bb_pct: float  # walks / batters_faced
    whiff_pct: float  # whiffs / swings
    csw_pct: float  # (called_strikes + whiffs) / total_pitches
    avg_velo: float
    avg_spin: float


class PitchingLeaderboard(BaseModel):
    players: list[PitchingLeaderRow]
    season: int
    total: int
