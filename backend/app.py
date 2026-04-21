from litestar import Litestar, get
from litestar.config.cors import CORSConfig
from litestar.di import Provide

from backend.api.analytics import AnalyticsController
from backend.api.charts import ChartController
from backend.api.compare import CompareController
from backend.api.framing import FramingController
from backend.api.games import GameController
from backend.api.hitting import HittingController
from backend.api.pitching import PitchingController
from backend.api.players import PlayerController
from backend.api.search import SearchController
from backend.api.standings import StandingsController
from backend.api.war import WarController
from backend.db import close_client, get_client

cors_config = CORSConfig(
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


app = Litestar(
    route_handlers=[
        health_check,
        PlayerController,
        HittingController,
        PitchingController,
        ChartController,
        CompareController,
        GameController,
        AnalyticsController,
        FramingController,
        SearchController,
        StandingsController,
        WarController,
    ],
    dependencies={"client": Provide(get_client, use_cache=True)},
    cors_config=cors_config,
    on_shutdown=[close_client],
)
