"""FIP (Fielding Independent Pitching) computation.

Computes FIP entirely from our own Statcast data — no external constants.
Uses RA/9 (run average) instead of ERA since we cannot distinguish
earned vs unearned runs from pitch-level data.
"""

from loguru import logger

from pipeline.compute._common import Client, delete_season, outs_recorded_sql

PLAYER_FIP_DDL = """
CREATE TABLE IF NOT EXISTS player_fip (
    player_id UInt32,
    season UInt16,
    ip Float64,
    k UInt32,
    bb UInt32,
    hbp UInt32,
    hr UInt32,
    fip Float64,
    fip_constant Float64,
    ra9 Float64
) ENGINE = ReplacingMergeTree()
ORDER BY (player_id, season)
"""


def _compute_league_fip_constant(
    client: Client,
    season: int,
) -> tuple[float, float]:
    """Compute the FIP constant and league RA/9 for a season.

    FIP_constant = lg_RA/9 - ((13*lg_HR + 3*(lg_BB+lg_HBP) - 2*lg_K) / lg_IP)

    Returns (fip_constant, league_ra9).
    """
    outs_expr = outs_recorded_sql()

    result = client.query(
        f"""
        SELECT
            countIf(events IN ('strikeout', 'strikeout_double_play')) AS k,
            countIf(events = 'walk') AS bb,
            countIf(events = 'hit_by_pitch') AS hbp,
            countIf(events = 'home_run') AS hr,
            {outs_expr} AS outs_recorded,
            sum(post_bat_score - bat_score) AS runs
        FROM pitches
        WHERE game_year = {{season:UInt16}}
          AND events IS NOT NULL
          AND game_type = 'R'
          AND bat_score IS NOT NULL
          AND post_bat_score IS NOT NULL
        """,
        parameters={"season": season},
    )
    k, bb, hbp, hr, outs, runs = result.result_rows[0]

    lg_ip = outs / 3.0
    lg_ra9 = runs / lg_ip * 9.0 if lg_ip > 0 else 0.0
    lg_fip_component = (13 * hr + 3 * (bb + hbp) - 2 * k) / lg_ip if lg_ip > 0 else 0.0
    fip_constant = lg_ra9 - lg_fip_component

    logger.info(
        "Season %d: lg_RA/9=%.3f, lg_IP=%.1f, FIP_constant=%.3f",
        season,
        lg_ra9,
        lg_ip,
        fip_constant,
    )
    return fip_constant, lg_ra9


def compute_fip_for_season(
    client: Client,
    season: int,
    min_ip: float = 10.0,
) -> int:
    """Compute FIP for all qualifying pitchers in a season.

    Returns the number of pitchers inserted.
    """
    logger.info("Computing FIP for %d (min_ip=%.1f)", season, min_ip)

    client.command(PLAYER_FIP_DDL)

    fip_constant, lg_ra9 = _compute_league_fip_constant(client, season)

    outs_expr = outs_recorded_sql()
    min_outs = int(min_ip * 3)

    result = client.query(
        f"""
        SELECT
            pitcher,
            countIf(events IN ('strikeout', 'strikeout_double_play')) AS k,
            countIf(events = 'walk') AS bb,
            countIf(events = 'hit_by_pitch') AS hbp,
            countIf(events = 'home_run') AS hr,
            {outs_expr} AS outs_recorded
        FROM pitches
        WHERE game_year = {{season:UInt16}}
          AND events IS NOT NULL
          AND game_type = 'R'
        GROUP BY pitcher
        HAVING outs_recorded >= {{min_outs:UInt32}}
        ORDER BY pitcher
        """,
        parameters={"season": season, "min_outs": min_outs},
    )

    rows_to_insert = []
    for row in result.result_rows:
        pitcher, k, bb, hbp, hr, outs = row
        ip = outs / 3.0
        fip = ((13 * hr + 3 * (bb + hbp) - 2 * k) / ip) + fip_constant

        rows_to_insert.append(
            [
                pitcher,
                season,
                ip,
                k,
                bb,
                hbp,
                hr,
                fip,
                fip_constant,
                lg_ra9,
            ]
        )

    if rows_to_insert:
        delete_season(client, "player_fip", season)
        client.insert(
            "player_fip",
            rows_to_insert,
            column_names=[
                "player_id",
                "season",
                "ip",
                "k",
                "bb",
                "hbp",
                "hr",
                "fip",
                "fip_constant",
                "ra9",
            ],
        )
        logger.info("Inserted FIP for %d pitchers in %d", len(rows_to_insert), season)

    return len(rows_to_insert)
