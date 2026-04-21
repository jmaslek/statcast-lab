"""Catcher framing: called strike rate vs expected on borderline pitches.

We bin pitch locations on a 20x20 grid over a window that extends a foot
beyond the zone on each side. The batter's strike zone moves by height, so
vertical coords are normalized to (plate_z - sz_bot) / (sz_top - sz_bot) and
horizontal coords to plate_x / (zone_half_width in feet).
"""
from collections import defaultdict

from loguru import logger

from pipeline.compute._common import Client, delete_season

ZONE_HALF_WIDTH = 0.8333  # feet
GRID_SIZE = 20
NORM_X = (-2.0, 2.0)
NORM_Z = (-0.5, 1.5)
RUNS_PER_STRIKE = 0.125


def _bin_index(value: float, bounds: tuple[float, float], n_bins: int) -> int:
    vmin, vmax = bounds
    idx = int((value - vmin) / (vmax - vmin) * n_bins)
    return max(0, min(n_bins - 1, idx))


def compute_framing_for_season(
    client: Client,
    season: int,
    min_called: int = 200,
) -> int:
    logger.info("Framing for {} (min_called={})", season, min_called)

    rows = client.query(
        """
        SELECT fielder_2, plate_x, plate_z, sz_top, sz_bot, description
        FROM pitches
        WHERE game_year = {season:UInt16}
          AND description IN ('called_strike', 'ball')
          AND fielder_2 IS NOT NULL
          AND plate_x IS NOT NULL
          AND plate_z IS NOT NULL
          AND sz_top IS NOT NULL
          AND sz_bot IS NOT NULL
        """,
        parameters={"season": season},
    ).result_rows

    if not rows:
        logger.warning("No called pitches for {}", season)
        return 0

    bin_strikes: dict[tuple[int, int], int] = defaultdict(int)
    bin_total: dict[tuple[int, int], int] = defaultdict(int)
    catcher_pitches: dict[int, list[tuple[tuple[int, int], int]]] = defaultdict(list)
    skipped = 0

    for catcher_id, plate_x, plate_z, sz_top, sz_bot, description in rows:
        zone_height = sz_top - sz_bot
        if zone_height <= 0:
            skipped += 1
            continue

        bx = _bin_index(plate_x / ZONE_HALF_WIDTH, NORM_X, GRID_SIZE)
        bz = _bin_index((plate_z - sz_bot) / zone_height, NORM_Z, GRID_SIZE)
        key = (bx, bz)
        is_strike = 1 if description == "called_strike" else 0

        bin_total[key] += 1
        bin_strikes[key] += is_strike
        catcher_pitches[catcher_id].append((key, is_strike))

    if skipped:
        logger.warning("Skipped {} pitches with bad strike-zone bounds", skipped)

    bin_rate = {k: bin_strikes[k] / bin_total[k] for k in bin_total}

    results = []
    for catcher_id, pitches in catcher_pitches.items():
        if len(pitches) < min_called:
            continue
        called_strikes = sum(s for _, s in pitches)
        expected = sum(bin_rate[k] for k, _ in pitches)
        above_avg = called_strikes - expected
        results.append((
            catcher_id, season, len(pitches), called_strikes,
            round(expected, 2), round(above_avg, 2),
            round(above_avg * RUNS_PER_STRIKE, 2),
        ))

    if not results:
        logger.warning("No catchers met min_called={}", min_called)
        return 0

    delete_season(client, "player_season_framing", season)

    client.insert(
        "player_season_framing",
        results,
        column_names=[
            "catcher_id", "season",
            "total_called", "called_strikes",
            "expected_strikes", "strikes_above_avg", "framing_runs",
        ],
    )

    logger.info("Wrote framing for {} catchers in {}", len(results), season)
    return len(results)
