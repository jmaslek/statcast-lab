from pydantic import BaseModel


class BattingWarRow(BaseModel):
    player_id: int
    name: str
    pa: int
    woba: float
    wrc_plus: float
    batting_runs: float
    war: float


class PitchingWarRow(BaseModel):
    player_id: int
    name: str
    ip: float
    ra9: float
    ra9_war: float
    re24: float
    re24_war: float


class WarLeaderboard(BaseModel):
    batting: list[BattingWarRow]
    pitching: list[PitchingWarRow]
    season: int
    batting_total: int = 0
    pitching_total: int = 0
