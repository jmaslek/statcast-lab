from litestar import Controller, get
from backend.db import Client
from backend.models.analytics import (
    RECountEntry,
    RECountMatrixData,
    REMatrixData,
    REMatrixEntry,
    LinearWeightsData,
    LinearWeightsRow,
    ParkFactorsData,
    ParkFactorRow,
)


def _decode_runners(base_out_state: int) -> tuple[int, str]:
    """Decode base_out_state (0-23) into (outs, runners_string)."""
    base_state = base_out_state // 3
    outs = base_out_state % 3
    on_1b = bool(base_state & 1)
    on_2b = bool(base_state & 2)
    on_3b = bool(base_state & 4)
    runners = (
        ("1" if on_1b else "-") + ("2" if on_2b else "-") + ("3" if on_3b else "-")
    )
    return outs, runners


class AnalyticsController(Controller):
    path = "/api/analytics"

    @get("/re-matrix")
    async def re_matrix(self, client: Client, season: int = 2025) -> REMatrixData:
        result = client.query(
            """
            SELECT base_out_state, outs, runners_on, expected_runs, occurrences
            FROM season_re_matrix FINAL
            WHERE season = {season:UInt16}
            ORDER BY outs, base_out_state
            """,
            parameters={"season": season},
        )
        entries = [
            REMatrixEntry(
                base_out_state=r[0],
                outs=r[1],
                runners_on=r[2],
                expected_runs=r[3],
                occurrences=r[4],
            )
            for r in result.result_rows
        ]
        return REMatrixData(season=season, entries=entries)

    @get("/linear-weights")
    async def linear_weights(self, client: Client, season: int = 2025) -> LinearWeightsData:
        result = client.query(
            """
            SELECT season, source, wBB, wHBP, w1B, w2B, w3B, wHR,
                   lg_woba, woba_scale
            FROM season_linear_weights FINAL
            WHERE season = {season:UInt16}
            ORDER BY source
            """,
            parameters={"season": season},
        )
        weights = [
            LinearWeightsRow(
                season=r[0],
                source=r[1],
                wBB=r[2],
                wHBP=r[3],
                w1B=r[4],
                w2B=r[5],
                w3B=r[6],
                wHR=r[7],
                lg_woba=r[8],
                woba_scale=r[9],
            )
            for r in result.result_rows
        ]
        return LinearWeightsData(season=season, weights=weights)

    @get("/park-factors")
    async def park_factors(self, client: Client, season: int = 2025) -> ParkFactorsData:
        result = client.query(
            """
            SELECT team, venue, home_games, road_games,
                   home_rpg, road_rpg, park_factor
            FROM season_park_factors FINAL
            WHERE season = {season:UInt16}
            ORDER BY park_factor DESC
            """,
            parameters={"season": season},
        )
        factors = [
            ParkFactorRow(
                team=r[0],
                venue=r[1],
                home_games=r[2],
                road_games=r[3],
                home_rpg=r[4],
                road_rpg=r[5],
                park_factor=r[6],
            )
            for r in result.result_rows
        ]
        return ParkFactorsData(season=season, factors=factors)

    @get("/re-count-matrix")
    async def re_count_matrix(self, client: Client, season: int = 2025) -> RECountMatrixData:
        result = client.query(
            """
            SELECT base_out_state, balls, strikes, expected_runs, occurrences
            FROM season_re_count_matrix FINAL
            WHERE season = {season:UInt16}
            ORDER BY base_out_state, balls, strikes
            """,
            parameters={"season": season},
        )
        entries = []
        for base_out_state, balls, strikes, expected_runs, occurrences in result.result_rows:
            outs, runners = _decode_runners(base_out_state)
            entries.append(RECountEntry(
                base_out_state=base_out_state,
                outs=outs,
                runners_on=runners,
                balls=balls,
                strikes=strikes,
                expected_runs=expected_runs,
                occurrences=occurrences,
            ))
        return RECountMatrixData(season=season, entries=entries)
