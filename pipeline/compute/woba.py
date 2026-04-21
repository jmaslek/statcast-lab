"""wOBA / wRC+ from published FanGraphs weights (fallback: most recent year).

See get_custom_weights() to use internally-derived weights from RE24 instead.
"""

from loguru import logger

from pipeline.compute._common import Client, delete_season

# FanGraphs wOBA weights — https://www.fangraphs.com/guts.aspx?type=cn
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
    if season in WOBA_WEIGHTS:
        return WOBA_WEIGHTS[season]
    return WOBA_WEIGHTS[max(WOBA_WEIGHTS)]


def get_custom_weights(client: Client, season: int) -> dict[str, float] | None:
    """Load internally-derived weights from season_linear_weights, or None."""
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


def store_fangraphs_weights(client: Client, season: int) -> None:
    """Upsert the FanGraphs weight row so we can diff against custom weights."""
    w = get_weights(season)
    lg_r_pa = w["lg_woba"] / w["woba_scale"] if w["woba_scale"] > 0 else 0.0
    client.command(
        "ALTER TABLE season_linear_weights DELETE "
        "WHERE season = {season:UInt16} AND source = 'fangraphs'",
        parameters={"season": season},
    )
    # run_out isn't published by FanGraphs — we derive it only for custom weights.
    client.insert(
        "season_linear_weights",
        [[
            season, "fangraphs",
            w["wBB"], w["wHBP"], w["w1B"], w["w2B"], w["w3B"], w["wHR"],
            0.0,
            w["lg_woba"], w["woba_scale"], lg_r_pa,
        ]],
        column_names=[
            "season", "source",
            "wBB", "wHBP", "w1B", "w2B", "w3B", "wHR",
            "run_out", "lg_woba", "woba_scale", "lg_r_pa",
        ],
    )


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
    # Standard wOBA denominator: AB + BB + SF + HBP. Statcast tracks `walk` and
    # `intent_walk` as separate events, so `bb` here already excludes IBBs and
    # no IBB subtraction is needed.
    denom = ab + bb + sf + hbp
    if denom == 0:
        return 0.0
    num = (
        weights["wBB"] * bb
        + weights["wHBP"] * hbp
        + weights["w1B"] * singles
        + weights["w2B"] * doubles
        + weights["w3B"] * triples
        + weights["wHR"] * hr
    )
    return num / denom


def _load_park_factors(client: Client, season: int) -> dict[str, float]:
    result = client.query(
        """
        SELECT team, park_factor
        FROM season_park_factors FINAL
        WHERE season = {season:UInt16}
        """,
        parameters={"season": season},
    )
    return dict(result.result_rows)


PLAYER_WOBA_DDL = """
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
"""


def compute_woba_for_season(
    client: Client,
    season: int,
    min_pa: int = 50,
    weight_source: str = "fangraphs",
) -> int:
    """Compute wOBA and park-adjusted wRC+. Park factors default to 1.0 (neutral).

    weight_source: 'fangraphs' (published) or 'custom' (from RE24-derived table).
    """
    if weight_source == "custom":
        weights = get_custom_weights(client, season)
        if weights is None:
            raise ValueError(
                f"No custom weights for {season}. "
                "Run 'compute linear-weights' first, or pass --weight-source=fangraphs."
            )
        logger.info("Using custom weights for {}", season)
    else:
        weights = get_weights(season)
        store_fangraphs_weights(client, season)
        logger.info("Using FanGraphs weights for {}", season)

    client.command(PLAYER_WOBA_DDL)

    park_factors = _load_park_factors(client, season)
    if park_factors:
        logger.info("{} park factors loaded — wRC+ park-adjusted", len(park_factors))
    else:
        logger.warning(
            "No park factors for {} — wRC+ not park-adjusted "
            "(run 'compute park-factors' first)", season,
        )

    result = client.query(
        """
        SELECT
            h.batter AS player_id,
            h.pa, h.ab, h.singles, h.doubles, h.triples, h.home_runs,
            h.walks, h.hbp, h.sac_flies,
            p.team
        FROM player_season_hitting AS h FINAL
        JOIN players AS p FINAL ON h.batter = p.player_id
        WHERE h.season = {season:UInt16}
          AND h.pa >= {min_pa:UInt64}
        """,
        parameters={"season": season, "min_pa": min_pa},
    )

    lg_woba = weights["lg_woba"]
    woba_scale = weights["woba_scale"]
    lg_r_pa = lg_woba / woba_scale if woba_scale > 0 else 0.0

    rows = []
    for (
        pid, pa, ab, singles, doubles, triples, hr, bb, hbp, sf, team,
    ) in result.result_rows:
        woba = calculate_player_woba(
            bb=bb, hbp=hbp,
            singles=singles, doubles=doubles, triples=triples, hr=hr,
            ab=ab, sf=sf, weights=weights,
        )

        # wRC+ = ((wRAA/PA + lgR/PA + lgR/PA*(1-PF)) / lgR/PA) * 100
        # At a neutral park (PF=1.0) this collapses to the un-adjusted form.
        if lg_r_pa > 0:
            wraa_per_pa = (woba - lg_woba) / woba_scale
            pf = park_factors.get(team, 1.0)
            wrc_plus = ((wraa_per_pa + lg_r_pa * (2 - pf)) / lg_r_pa) * 100
        else:
            wrc_plus = 100.0

        rows.append([pid, season, pa, woba, woba_scale, lg_woba, wrc_plus])

    delete_season(client, "player_woba", season)
    if rows:
        client.insert(
            "player_woba",
            rows,
            column_names=[
                "player_id", "season", "pa",
                "woba", "woba_scale", "lg_woba", "wrc_plus",
            ],
        )
    return len(rows)
