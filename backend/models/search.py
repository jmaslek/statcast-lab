from pydantic import BaseModel


class SearchPitch(BaseModel):
    game_date: str
    batter_name: str | None
    pitcher_name: str | None
    batter_team: str | None
    pitcher_team: str | None
    pitch_type: str | None
    pitch_name: str | None
    release_speed: float | None
    pfx_x: float | None
    pfx_z: float | None
    plate_x: float | None
    plate_z: float | None
    launch_speed: float | None
    launch_angle: float | None
    hit_distance: float | None
    events: str | None
    description: str | None
    zone: int | None
    stand: str | None
    p_throws: str | None
    balls: int
    strikes: int
    barrel: int | None
    estimated_ba: float | None
    estimated_woba: float | None
    bat_speed: float | None
    swing_length: float | None


class SearchAggRow(BaseModel):
    """Aggregated row when grouping by player."""
    player_id: int
    name: str
    pitches: int
    avg_velo: float | None
    max_velo: float | None
    avg_launch_speed: float | None
    avg_launch_angle: float | None
    barrel_pct: float | None
    whiff_pct: float | None
    avg_spin: float | None
    xba: float | None
    xwoba: float | None
    hard_hit_pct: float | None


class SearchResult(BaseModel):
    pitches: list[SearchPitch] | None = None
    aggregated: list[SearchAggRow] | None = None
    total: int
    season: int
    mode: str  # "pitches" or "aggregated"
