from pydantic import BaseModel


class ArsenalRow(BaseModel):
    pitcher_id: int
    name: str
    pitch_type: str
    pitch_name: str
    pitch_count: int
    usage_pct: float
    avg_velo: float
    max_velo: float
    avg_spin: float
    avg_pfx_x: float
    avg_pfx_z: float
    whiff_pct: float
    csw_pct: float
    put_away_pct: float
    zone_pct: float
    chase_pct: float
    avg_exit_velo: float | None
    gb_pct: float


class ArsenalData(BaseModel):
    rows: list[ArsenalRow]
    season: int
    total: int


class PitcherArsenalData(BaseModel):
    pitcher_id: int
    name: str
    pitches: list[ArsenalRow]
    season: int
