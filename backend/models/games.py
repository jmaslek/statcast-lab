from pydantic import BaseModel
from datetime import date


class GameSummary(BaseModel):
    game_pk: int
    game_date: date
    home_team: str
    away_team: str
    home_score: int | None
    away_score: int | None


class GameListResponse(BaseModel):
    games: list[GameSummary]
    date: date


class PitchDetail(BaseModel):
    at_bat_number: int
    pitch_number: int
    inning: int
    inning_topbot: str
    pitcher: int
    batter: int
    pitch_type: str | None
    release_speed: float | None
    description: str
    events: str | None
    plate_x: float | None
    plate_z: float | None
    launch_speed: float | None
    launch_angle: float | None


class GameDetail(BaseModel):
    game_pk: int
    game_date: date
    home_team: str
    away_team: str
    pitches: list[PitchDetail]
    total_pitches: int
