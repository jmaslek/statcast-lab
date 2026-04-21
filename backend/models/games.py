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
    pitcher_name: str
    batter: int
    batter_name: str
    pitch_type: str | None
    release_speed: float | None
    description: str
    events: str | None
    plate_x: float | None
    plate_z: float | None
    launch_speed: float | None
    launch_angle: float | None
    home_win_exp: float | None


class GameDetail(BaseModel):
    game_pk: int
    game_date: date
    home_team: str
    away_team: str
    pitches: list[PitchDetail]
    total_pitches: int


# ---- Boxscore models (from MLB Stats API) ----


class BoxscoreInning(BaseModel):
    num: int
    away_runs: int
    away_hits: int
    away_errors: int
    home_runs: int
    home_hits: int
    home_errors: int


class BoxscoreBatter(BaseModel):
    player_id: int
    name: str
    position: str
    batting_order: str | None
    ab: int
    r: int
    h: int
    rbi: int
    bb: int
    k: int
    avg: str
    obp: str
    slg: str
    summary: str


class BoxscorePitcher(BaseModel):
    player_id: int
    name: str
    ip: str
    h: int
    r: int
    er: int
    bb: int
    k: int
    pitches: int
    strikes: int
    era: str
    summary: str
    note: str | None


class BoxscoreTeamTotals(BaseModel):
    runs: int
    hits: int
    errors: int
    lob: int


class BoxscoreTeam(BaseModel):
    team_name: str
    batters: list[BoxscoreBatter]
    pitchers: list[BoxscorePitcher]
    totals: BoxscoreTeamTotals


class BoxscoreResponse(BaseModel):
    game_pk: int
    innings: list[BoxscoreInning]
    away: BoxscoreTeam
    home: BoxscoreTeam


# ---- WPA models ----


class WpaPlay(BaseModel):
    at_bat_number: int
    inning: int
    inning_topbot: str
    batter_name: str
    pitcher_name: str
    events: str
    home_win_exp: float | None
    delta_home_win_exp: float | None


class WpaData(BaseModel):
    game_pk: int
    home_team: str
    away_team: str
    plays: list[WpaPlay]
