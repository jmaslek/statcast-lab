from pydantic import BaseModel


class FramingLeaderRow(BaseModel):
    player_id: int
    name: str
    total_called: int
    called_strikes: int
    strike_rate: float
    strikes_above_avg: float
    framing_runs: float


class FramingLeaderboard(BaseModel):
    players: list[FramingLeaderRow]
    season: int
    total: int
