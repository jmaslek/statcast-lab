"""Catcher framing: called strike rate vs expected on borderline pitches."""

from loguru import logger

from pipeline.compute._common import Client, delete_season

# Zone parameters
ZONE_HALF_WIDTH = 0.8333  # feet
GRID_SIZE = 20
NORM_X_MIN, NORM_X_MAX = -2.0, 2.0
NORM_Z_MIN, NORM_Z_MAX = -0.5, 1.5
RUNS_PER_STRIKE = 0.125


def _bin_index(value: float, vmin: float, vmax: float, n_bins: int) -> int:
    frac = (value - vmin) / (vmax - vmin)
    idx = int(frac * n_bins)
    return max(0, min(n_bins - 1, idx))


def compute_framing_for_season(
    client: Client,
    season: int,
    min_called: int = 200,
) -> int:
    """Compute catcher framing metrics for a season. Returns count of catchers written."""
    logger.info("Querying called pitches for %d...", season)

    rows = client.query(
        """
        SELECT
            fielder_2,
            plate_x,
            plate_z,
            sz_top,
            sz_bot,
            description
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
        logger.warning("No called pitches found for %d", season)
        return 0

    logger.info("Processing %d called pitches...", len(rows))

    bin_strikes: dict[tuple[int, int], int] = {}
    bin_total: dict[tuple[int, int], int] = {}
    catcher_pitches: dict[int, list[tuple[tuple[int, int], int]]] = {}

    for catcher_id, plate_x, plate_z, sz_top, sz_bot, description in rows:
        norm_x = plate_x / ZONE_HALF_WIDTH
        zone_height = sz_top - sz_bot
        if zone_height <= 0:
            continue
        norm_z = (plate_z - sz_bot) / zone_height

        bx = _bin_index(norm_x, NORM_X_MIN, NORM_X_MAX, GRID_SIZE)
        bz = _bin_index(norm_z, NORM_Z_MIN, NORM_Z_MAX, GRID_SIZE)
        bin_key = (bx, bz)

        is_strike = 1 if description == "called_strike" else 0

        bin_total[bin_key] = bin_total.get(bin_key, 0) + 1
        bin_strikes[bin_key] = bin_strikes.get(bin_key, 0) + is_strike

        if catcher_id not in catcher_pitches:
            catcher_pitches[catcher_id] = []
        catcher_pitches[catcher_id].append((bin_key, is_strike))

    bin_rate: dict[tuple[int, int], float] = {}
    for key in bin_total:
        bin_rate[key] = bin_strikes[key] / bin_total[key]

    results: list[tuple] = []
    for catcher_id, pitches in catcher_pitches.items():
        if len(pitches) < min_called:
            continue

        total_called = len(pitches)
        called_strikes = sum(is_s for _, is_s in pitches)
        expected_strikes = sum(bin_rate[bk] for bk, _ in pitches)
        strikes_above_avg = called_strikes - expected_strikes
        framing_runs = strikes_above_avg * RUNS_PER_STRIKE

        results.append(
            (
                catcher_id,
                season,
                total_called,
                called_strikes,
                round(expected_strikes, 2),
                round(strikes_above_avg, 2),
                round(framing_runs, 2),
            )
        )

    if not results:
        logger.warning("No catchers met min_called=%d threshold", min_called)
        return 0

    logger.info("Writing framing data for %d catchers...", len(results))
    delete_season(client, "player_season_framing", season)

    client.insert(
        "player_season_framing",
        results,
        column_names=[
            "catcher_id",
            "season",
            "total_called",
            "called_strikes",
            "expected_strikes",
            "strikes_above_avg",
            "framing_runs",
        ],
    )

    logger.info("Wrote framing data for %d catchers in %d", len(results), season)
    return len(results)
