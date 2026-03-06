from pydantic import BaseModel


class REMatrixEntry(BaseModel):
    base_out_state: int
    outs: int
    runners_on: str
    expected_runs: float
    occurrences: int


class REMatrixData(BaseModel):
    season: int
    entries: list[REMatrixEntry]


class LinearWeightsRow(BaseModel):
    season: int
    source: str
    wBB: float
    wHBP: float
    w1B: float
    w2B: float
    w3B: float
    wHR: float
    lg_woba: float
    woba_scale: float


class LinearWeightsData(BaseModel):
    season: int
    weights: list[LinearWeightsRow]


class ParkFactorRow(BaseModel):
    team: str
    venue: str
    home_games: int
    road_games: int
    home_rpg: float
    road_rpg: float
    park_factor: float


class ParkFactorsData(BaseModel):
    season: int
    factors: list[ParkFactorRow]
