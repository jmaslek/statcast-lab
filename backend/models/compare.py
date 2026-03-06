from pydantic import BaseModel


class ComparePlayerStats(BaseModel):
    player_id: int
    name: str
    position: str
    team: str
    season: int
    hitting: dict | None = None  # Same shape as player stats hitting dict
    pitching: dict | None = None  # Same shape as player stats pitching dict


class CompareResponse(BaseModel):
    players: list[ComparePlayerStats]
    season: int
