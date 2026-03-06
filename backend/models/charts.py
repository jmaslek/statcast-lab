from pydantic import BaseModel


class SprayChartPoint(BaseModel):
    hc_x: float
    hc_y: float
    events: str
    launch_speed: float | None
    launch_angle: float | None
    bb_type: str | None


class SprayChartData(BaseModel):
    points: list[SprayChartPoint]
    player_id: int
    season: int


class ZonePoint(BaseModel):
    plate_x: float
    plate_z: float
    description: str
    pitch_type: str | None
    release_speed: float | None


class ZoneData(BaseModel):
    points: list[ZonePoint]
    player_id: int
    season: int


class MovementPoint(BaseModel):
    pfx_x: float
    pfx_z: float
    pitch_type: str
    pitch_name: str | None
    release_speed: float | None


class LeagueAverageMovement(BaseModel):
    pitch_type: str
    pitch_name: str | None
    avg_pfx_x: float
    avg_pfx_z: float
    std_pfx_x: float
    std_pfx_z: float
    count: int


class PitchTypeSummary(BaseModel):
    pitch_type: str
    pitch_name: str | None
    usage_pct: float
    avg_speed: float | None
    league_avg_speed: float | None
    count: int


class MovementData(BaseModel):
    points: list[MovementPoint]
    player_id: int
    season: int
    p_throws: str
    league_averages: list[LeagueAverageMovement]
    pitch_summary: list[PitchTypeSummary]
