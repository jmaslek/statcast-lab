from litestar import Controller, get
from backend.models.standings import StandingsResponse
from backend.services.standings import fetch_standings


class StandingsController(Controller):
    path = "/api/standings"

    @get("/")
    async def get_standings(self, season: int = 2026) -> StandingsResponse:
        """Get MLB standings from the Stats API."""
        return await fetch_standings(season)
