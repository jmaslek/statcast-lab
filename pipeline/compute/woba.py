"""wOBA calculation pipeline."""

from loguru import logger

from pipeline.compute._common import Client

# Published FanGraphs wOBA weights by season
# Source: https://www.fangraphs.com/guts.aspx?type=cn
WOBA_WEIGHTS: dict[int, dict[str, float]] = {
    2015: {
        "wBB": 0.687,
        "wHBP": 0.718,
        "w1B": 0.881,
        "w2B": 1.256,
        "w3B": 1.594,
        "wHR": 2.065,
        "woba_scale": 1.251,
        "lg_woba": 0.313,
    },
    2016: {
        "wBB": 0.691,
        "wHBP": 0.721,
        "w1B": 0.878,
        "w2B": 1.242,
        "w3B": 1.569,
        "wHR": 2.015,
        "woba_scale": 1.212,
        "lg_woba": 0.318,
    },
    2017: {
        "wBB": 0.693,
        "wHBP": 0.723,
        "w1B": 0.877,
        "w2B": 1.232,
        "w3B": 1.552,
        "wHR": 1.980,
        "woba_scale": 1.185,
        "lg_woba": 0.321,
    },
    2018: {
        "wBB": 0.690,
        "wHBP": 0.720,
        "w1B": 0.880,
        "w2B": 1.247,
        "w3B": 1.578,
        "wHR": 2.031,
        "woba_scale": 1.236,
        "lg_woba": 0.315,
    },
    2019: {
        "wBB": 0.690,
        "wHBP": 0.720,
        "w1B": 0.870,
        "w2B": 1.217,
        "w3B": 1.529,
        "wHR": 1.940,
        "woba_scale": 1.157,
        "lg_woba": 0.320,
    },
    2020: {
        "wBB": 0.699,
        "wHBP": 0.728,
        "w1B": 0.883,
        "w2B": 1.238,
        "w3B": 1.558,
        "wHR": 1.979,
        "woba_scale": 1.186,
        "lg_woba": 0.320,
    },
    2021: {
        "wBB": 0.692,
        "wHBP": 0.722,
        "w1B": 0.879,
        "w2B": 1.242,
        "w3B": 1.568,
        "wHR": 2.015,
        "woba_scale": 1.208,
        "lg_woba": 0.318,
    },
    2022: {
        "wBB": 0.696,
        "wHBP": 0.726,
        "w1B": 0.883,
        "w2B": 1.244,
        "w3B": 1.569,
        "wHR": 2.007,
        "woba_scale": 1.209,
        "lg_woba": 0.310,
    },
    2023: {
        "wBB": 0.696,
        "wHBP": 0.726,
        "w1B": 0.883,
        "w2B": 1.244,
        "w3B": 1.569,
        "wHR": 2.004,
        "woba_scale": 1.204,
        "lg_woba": 0.318,
    },
    2024: {
        "wBB": 0.689,
        "wHBP": 0.720,
        "w1B": 0.882,
        "w2B": 1.254,
        "w3B": 1.590,
        "wHR": 2.050,
        "woba_scale": 1.242,
        "lg_woba": 0.310,
    },
    2025: {
        "wBB": 0.691,
        "wHBP": 0.722,
        "w1B": 0.882,
        "w2B": 1.252,
        "w3B": 1.584,
        "wHR": 2.037,
        "woba_scale": 1.232,
        "lg_woba": 0.313,
    },
}


def get_weights(season: int) -> dict[str, float]:
    """Get wOBA weights for a season. Falls back to most recent if not available."""
    if season in WOBA_WEIGHTS:
        return WOBA_WEIGHTS[season]
    # Fall back to most recent year
    latest = max(WOBA_WEIGHTS.keys())
    return WOBA_WEIGHTS[latest]


def get_custom_weights(
    client: Client,
    season: int,
) -> dict[str, float] | None:
    """Read custom linear weights from season_linear_weights table.

    Returns None if no custom weights exist for the season.
    """
    result = client.query(
        """
        SELECT wBB, wHBP, w1B, w2B, w3B, wHR, woba_scale, lg_woba, lg_r_pa
        FROM season_linear_weights FINAL
        WHERE season = {season:UInt16} AND source = 'custom'
        """,
        parameters={"season": season},
    )
    if not result.result_rows:
        return None
    row = result.result_rows[0]
    return {
        "wBB": row[0],
        "wHBP": row[1],
        "w1B": row[2],
        "w2B": row[3],
        "w3B": row[4],
        "wHR": row[5],
        "woba_scale": row[6],
        "lg_woba": row[7],
        "lg_r_pa": row[8],
    }


def store_fangraphs_weights(
    client: Client,
    season: int,
) -> None:
    """Store FanGraphs weights in season_linear_weights for comparison."""
    weights = get_weights(season)
    lg_r_pa = (
        weights["lg_woba"] / weights["woba_scale"] if weights["woba_scale"] > 0 else 0.0
    )
    client.command(
        "ALTER TABLE season_linear_weights DELETE WHERE season = {season:UInt16} AND source = 'fangraphs'",
        parameters={"season": season},
    )
    client.insert(
        "season_linear_weights",
        [
            [
                season,
                "fangraphs",
                weights["wBB"],
                weights["wHBP"],
                weights["w1B"],
                weights["w2B"],
                weights["w3B"],
                weights["wHR"],
                0.0,  # run_out not available from FanGraphs
                weights["lg_woba"],
                weights["woba_scale"],
                lg_r_pa,
            ]
        ],
        column_names=[
            "season",
            "source",
            "wBB",
            "wHBP",
            "w1B",
            "w2B",
            "w3B",
            "wHR",
            "run_out",
            "lg_woba",
            "woba_scale",
            "lg_r_pa",
        ],
    )
    logger.info("Stored FanGraphs weights for %d in season_linear_weights", season)


def calculate_player_woba(
    bb: int,
    hbp: int,
    singles: int,
    doubles: int,
    triples: int,
    hr: int,
    ab: int,
    sf: int,
    weights: dict[str, float],
) -> float:
    """Calculate wOBA for a single player given counting stats and weights.

    Note: Statcast separates 'walk' from 'intent_walk', so bb already
    excludes intentional walks — no IBB subtraction needed.
    """
    numerator = (
        weights["wBB"] * bb
        + weights["wHBP"] * hbp
        + weights["w1B"] * singles
        + weights["w2B"] * doubles
        + weights["w3B"] * triples
        + weights["wHR"] * hr
    )
    denominator = ab + bb + sf + hbp
    if denominator == 0:
        return 0.0
    return numerator / denominator


def compute_woba_for_season(
    client: Client,
    season: int,
    min_pa: int = 50,
    weight_source: str = "fangraphs",
) -> int:
    """Compute wOBA for all qualifying players in a season and store results.

    Args:
        weight_source: "fangraphs" for hardcoded FanGraphs weights (default),
                       "custom" to read from season_linear_weights table.

    Returns number of players computed.
    """
    if weight_source == "custom":
        weights = get_custom_weights(client, season)
        if weights is None:
            msg = (
                f"No custom weights for {season}. "
                "Run 'compute linear-weights' first, or use --weight-source=fangraphs."
            )
            raise ValueError(msg)
        logger.info("Using custom linear weights for %d", season)
    else:
        weights = get_weights(season)
        store_fangraphs_weights(client, season)
        logger.info("Using FanGraphs weights for %d", season)

    # Create the woba results table if it doesn't exist
    client.command("""
        CREATE TABLE IF NOT EXISTS player_woba (
            player_id UInt32,
            season UInt16,
            pa UInt64,
            woba Float64,
            woba_scale Float64,
            lg_woba Float64,
            wrc_plus Float64
        ) ENGINE = ReplacingMergeTree()
        ORDER BY (player_id, season)
    """)

    # Query player counting stats from the materialized view
    result = client.query(
        """
        SELECT
            batter AS player_id,
            pa, ab, singles, doubles, triples, home_runs,
            walks, hbp, sac_flies
        FROM player_season_hitting FINAL
        WHERE season = {season:UInt16}
          AND pa >= {min_pa:UInt64}
        """,
        parameters={"season": season, "min_pa": min_pa},
    )

    rows_to_insert = []
    for row in result.result_rows:
        pid, pa, ab, singles, doubles, triples, hr, bb, hbp, sf = row

        woba = calculate_player_woba(
            bb=bb,
            hbp=hbp,
            singles=singles,
            doubles=doubles,
            triples=triples,
            hr=hr,
            ab=ab,
            sf=sf,
            weights=weights,
        )

        # wRC+ = ((wOBA - lgwOBA) / wOBA_scale + lgR/PA) / lgR/PA * 100
        # Simplified: using league R/PA approximation
        lg_r_pa = weights["lg_woba"] / weights["woba_scale"]
        wrc_plus = (
            ((woba - weights["lg_woba"]) / weights["woba_scale"] + lg_r_pa)
            / lg_r_pa
            * 100
            if lg_r_pa > 0
            else 100.0
        )

        rows_to_insert.append(
            [pid, season, pa, woba, weights["woba_scale"], weights["lg_woba"], wrc_plus]
        )

    if rows_to_insert:
        client.insert(
            "player_woba",
            rows_to_insert,
            column_names=[
                "player_id",
                "season",
                "pa",
                "woba",
                "woba_scale",
                "lg_woba",
                "wrc_plus",
            ],
        )

    return len(rows_to_insert)
