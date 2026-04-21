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


class PitchUsageByCountCell(BaseModel):
    pitch_type: str
    pitch_name: str | None
    count_state: str  # e.g. "0-0", "1-2"
    usage_pct: float
    num_pitches: int
    avg_velo: float | None
    whiff_pct: float | None


class PitchUsageByCountData(BaseModel):
    pitcher_id: int
    name: str
    season: int
    pitch_types: list[str]  # ordered by overall usage
    pitch_names: dict[str, str]
    counts: list[str]  # ordered 0-0, 0-1, 0-2, 1-0, etc.
    cells: list[PitchUsageByCountCell]
