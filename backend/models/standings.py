"""Pydantic models for MLB standings."""

from pydantic import BaseModel


class TeamRecord(BaseModel):
    team_id: int
    team_name: str
    team_abbrev: str
    wins: int
    losses: int
    pct: str
    gb: str
    home_record: str
    away_record: str
    last_ten: str
    streak: str
    runs_scored: int
    runs_allowed: int
    run_diff: int
    division_rank: int


class DivisionStandings(BaseModel):
    division_name: str
    league_name: str
    teams: list[TeamRecord]


class StandingsResponse(BaseModel):
    season: int
    divisions: list[DivisionStandings]
