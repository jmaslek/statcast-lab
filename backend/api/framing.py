from litestar import Controller, get
from backend.db import Client
from backend.models.framing import FramingLeaderboard, FramingLeaderRow


class FramingController(Controller):
    path = "/api/framing"

    @get("/leaderboard")
    async def leaderboard(
        self,
        client: Client,
        season: int = 2025,
        limit: int = 50,
    ) -> FramingLeaderboard:

        result = client.query(
            """
            SELECT
                f.catcher_id AS player_id,
                p.name_full AS name,
                f.total_called,
                f.called_strikes,
                f.strikes_above_avg,
                f.framing_runs
            FROM player_season_framing AS f FINAL
            JOIN players AS p FINAL ON f.catcher_id = p.player_id
            WHERE f.season = {season:UInt16}
            ORDER BY f.framing_runs DESC
            LIMIT {limit:UInt32}
            """,
            parameters={"season": season, "limit": limit},
        )

        players = []
        for row in result.result_rows:
            (
                player_id,
                name,
                total_called,
                called_strikes,
                strikes_above_avg,
                framing_runs,
            ) = row
            strike_rate = round(
                (called_strikes / total_called * 100) if total_called else 0, 1
            )

            players.append(
                FramingLeaderRow(
                    player_id=player_id,
                    name=name,
                    total_called=total_called,
                    called_strikes=called_strikes,
                    strike_rate=strike_rate,
                    strikes_above_avg=round(strikes_above_avg, 1),
                    framing_runs=round(framing_runs, 1),
                )
            )

        return FramingLeaderboard(players=players, season=season, total=len(players))
