from datetime import date, timedelta

import click

from pipeline.compute.arsenal import compute_arsenal_for_season
from pipeline.compute.batted_ball import compute_batted_ball_for_season
from pipeline.compute.fip import compute_fip_for_season
from pipeline.compute.framing import compute_framing_for_season
from pipeline.compute.park_factors import compute_park_factors
from pipeline.compute.platoon_splits import compute_platoon_splits_for_season
from pipeline.compute.run_expectancy import (
    compute_linear_weights,
    compute_player_re24,
    compute_re_matrix,
)
from pipeline.compute.war import compute_batting_war, compute_pitching_war
from pipeline.compute.woba import compute_woba_for_season
from pipeline.db import get_client
from pipeline.ingest.players import load_players, load_teams
from pipeline.ingest.statcast import fetch_and_load
from pipeline.schema import create_all_tables


@click.group()
def cli() -> None:
    """MLB data pipeline CLI."""


@cli.command("init-db")
def init_db() -> None:
    """Create all tables and materialized views in ClickHouse."""
    client = get_client()
    create_all_tables(client)
    click.echo("All tables and materialized views created.")


@cli.command()
@click.option(
    "--start",
    required=True,
    type=click.DateTime(formats=["%Y-%m-%d"]),
    help="Start date (YYYY-MM-DD).",
)
@click.option(
    "--end",
    required=True,
    type=click.DateTime(formats=["%Y-%m-%d"]),
    help="End date (YYYY-MM-DD).",
)
@click.option(
    "--chunk-days",
    default=7,
    show_default=True,
    type=int,
    help="Number of days per fetch chunk.",
)
def backfill(start, end, chunk_days: int) -> None:
    """Historical backfill of Statcast data."""
    client = get_client()
    total = fetch_and_load(
        client,
        start=start.date(),
        end=end.date(),
        chunk_days=chunk_days,
    )
    click.echo(f"Backfill complete. Total rows: {total}")


@cli.command()
@click.option(
    "--date",
    "target_date",
    default=None,
    type=click.DateTime(formats=["%Y-%m-%d"]),
    help="Date to pull (YYYY-MM-DD). Defaults to yesterday.",
)
def daily(target_date) -> None:
    """Pull a single day of Statcast data (defaults to yesterday)."""
    if target_date is None:
        day = date.today() - timedelta(days=1)
    else:
        day = target_date.date()

    client = get_client()
    total = fetch_and_load(
        client,
        start=day,
        end=day,
        chunk_days=1,
    )
    click.echo(f"Daily pull complete for {day}. Total rows: {total}")


@cli.command()
@click.option("--season", required=True, type=int, help="Season year")
def players(season):
    """Refresh players and teams dimension tables."""
    client = get_client()
    load_teams(client)
    load_players(client, season=season)
    click.echo("Done.")
    client.close()


@cli.group()
def compute():
    """Calculate derived metrics."""


def _compute_all_for_season(client, season: int) -> None:
    """Run all compute steps for a single season in the correct order."""
    click.echo(f"\n{'='*50}")
    click.echo(f"Computing all derived metrics for {season}")
    click.echo(f"{'='*50}")

    click.echo(f"[{season}] RE matrix...")
    matrix = compute_re_matrix(client, season)
    click.echo(f"  -> {len(matrix)} states")

    click.echo(f"[{season}] Linear weights...")
    weights = compute_linear_weights(client, season, re_matrix=matrix)
    click.echo(f"  -> w1B={weights['w1B']:.3f}, wHR={weights['wHR']:.3f}")

    click.echo(f"[{season}] Player RE24...")
    count = compute_player_re24(client, season, re_matrix=matrix)
    click.echo(f"  -> {count} players")

    click.echo(f"[{season}] wOBA...")
    count = compute_woba_for_season(client, season)
    click.echo(f"  -> {count} players")

    click.echo(f"[{season}] Batting WAR...")
    count = compute_batting_war(client, season)
    click.echo(f"  -> {count} players")

    click.echo(f"[{season}] FIP...")
    count = compute_fip_for_season(client, season)
    click.echo(f"  -> {count} pitchers")

    click.echo(f"[{season}] Pitching WAR...")
    count = compute_pitching_war(client, season)
    click.echo(f"  -> {count} pitchers")

    click.echo(f"[{season}] Arsenal...")
    count = compute_arsenal_for_season(client, season)
    click.echo(f"  -> {count} pitcher-pitch rows")

    click.echo(f"[{season}] Batted ball...")
    count = compute_batted_ball_for_season(client, season)
    click.echo(f"  -> {count} batters")

    click.echo(f"[{season}] Platoon splits...")
    count = compute_platoon_splits_for_season(client, season)
    click.echo(f"  -> {count} batter-split rows")

    click.echo(f"[{season}] Park factors...")
    count = compute_park_factors(client, season)
    click.echo(f"  -> {count} teams")

    click.echo(f"[{season}] Framing...")
    count = compute_framing_for_season(client, season)
    click.echo(f"  -> {count} catchers")

    click.echo(f"[{season}] Done.")


@compute.command("all")
@click.option("--season", required=True, type=int, help="Season year")
def compute_all(season):
    """Run all compute steps for a season in the correct order."""
    client = get_client()
    _compute_all_for_season(client, season)
    client.close()


@compute.command("all-seasons")
@click.option("--start", default=2020, type=int, help="First season")
@click.option("--end", default=2025, type=int, help="Last season")
def compute_all_seasons(start, end):
    """Run all compute steps for a range of seasons."""
    client = get_client()
    for season in range(start, end + 1):
        _compute_all_for_season(client, season)
    client.close()


@compute.command()
@click.option("--season", required=True, type=int, help="Season year")
@click.option("--min-pa", default=50, help="Minimum plate appearances")
@click.option(
    "--weight-source",
    type=click.Choice(["fangraphs", "custom"]),
    default="fangraphs",
    show_default=True,
    help="Weight source: 'fangraphs' (hardcoded) or 'custom' (from RE24).",
)
def woba(season, min_pa, weight_source):
    """Calculate wOBA and wRC+ for all qualifying players."""
    client = get_client()
    count = compute_woba_for_season(
        client, season, min_pa, weight_source=weight_source
    )
    click.echo(
        f"Computed wOBA for {count} players in {season} (source: {weight_source})"
    )
    client.close()


@compute.command("batting-war")
@click.option("--season", required=True, type=int, help="Season year")
@click.option("--min-pa", default=50, help="Minimum plate appearances")
def batting_war(season, min_pa):
    """Compute batting WAR for all qualifying hitters."""
    client = get_client()
    count = compute_batting_war(client, season, min_pa=min_pa)
    click.echo(f"Computed batting WAR for {count} players in {season}")
    client.close()


@compute.command("pitching-war")
@click.option("--season", required=True, type=int, help="Season year")
@click.option("--min-ip", default=10.0, help="Minimum innings pitched")
def pitching_war(season, min_ip):
    """Compute pitching WAR (RA9-based and RE24-based)."""
    client = get_client()
    count = compute_pitching_war(client, season, min_ip=min_ip)
    click.echo(f"Computed pitching WAR for {count} pitchers in {season}")
    client.close()


@compute.command("fip")
@click.option("--season", required=True, type=int, help="Season year")
@click.option("--min-ip", default=10.0, help="Minimum innings pitched")
def fip(season, min_ip):
    """Compute FIP for all qualifying pitchers."""
    client = get_client()
    count = compute_fip_for_season(client, season, min_ip=min_ip)
    click.echo(f"Computed FIP for {count} pitchers in {season}")
    client.close()


@compute.command("framing")
@click.option("--season", required=True, type=int, help="Season year")
@click.option(
    "--min-called", default=200, show_default=True, help="Minimum called pitches"
)
def framing(season, min_called):
    """Compute catcher framing metrics for a season."""
    client = get_client()
    count = compute_framing_for_season(client, season, min_called=min_called)
    click.echo(f"Computed framing for {count} catchers in {season}")
    client.close()


@compute.command("re-matrix")
@click.option("--season", required=True, type=int, help="Season year")
def re_matrix(season):
    """Compute RE24 matrix for a season from game data."""
    client = get_client()
    matrix = compute_re_matrix(client, season)
    click.echo(f"Computed RE matrix with {len(matrix)} states for {season}")
    client.close()


@compute.command("linear-weights")
@click.option("--season", required=True, type=int, help="Season year")
def linear_weights(season):
    """Derive custom linear weights from RE24 matrix."""
    client = get_client()
    weights = compute_linear_weights(client, season)
    click.echo(f"Custom linear weights for {season}:")
    for k, v in weights.items():
        click.echo(f"  {k}: {v:.4f}")
    client.close()


@compute.command("player-re24")
@click.option("--season", required=True, type=int, help="Season year")
@click.option("--min-pa", default=50, help="Minimum plate appearances")
def player_re24(season, min_pa):
    """Compute per-player RE24 for a season."""
    client = get_client()
    count = compute_player_re24(client, season, min_pa=min_pa)
    click.echo(f"Computed RE24 for {count} players in {season}")
    client.close()


@compute.command("arsenal")
@click.option("--season", required=True, type=int, help="Season year")
@click.option(
    "--min-pitches",
    default=50,
    show_default=True,
    help="Minimum pitches per pitch type",
)
def arsenal(season, min_pitches):
    """Compute pitcher arsenal profiles for a season."""
    client = get_client()
    count = compute_arsenal_for_season(client, season, min_pitches=min_pitches)
    click.echo(
        f"Computed arsenal profiles: {count} pitcher-pitch_type rows in {season}"
    )
    client.close()


@compute.command("batted-ball")
@click.option("--season", required=True, type=int, help="Season year")
@click.option(
    "--min-bbe", default=25, show_default=True, help="Minimum batted ball events"
)
def batted_ball(season, min_bbe):
    """Compute batted ball profiles for all qualifying hitters."""
    client = get_client()
    count = compute_batted_ball_for_season(client, season, min_bbe=min_bbe)
    click.echo(f"Computed batted ball profiles for {count} batters in {season}")
    client.close()


@compute.command("platoon-splits")
@click.option("--season", required=True, type=int, help="Season year")
@click.option("--min-pa", default=30, show_default=True, help="Minimum PA per split")
def platoon_splits(season, min_pa):
    """Compute platoon splits for all qualifying hitters."""
    client = get_client()
    count = compute_platoon_splits_for_season(client, season, min_pa=min_pa)
    click.echo(f"Computed platoon splits: {count} batter-split rows in {season}")
    client.close()


@compute.command("park-factors")
@click.option("--season", required=True, type=int, help="Season year")
def park_factors(season):
    """Compute park factors for each team's home venue."""
    client = get_client()
    count = compute_park_factors(client, season)
    click.echo(f"Computed park factors for {count} teams in {season}")
    client.close()


@compute.command("all-re")
@click.option("--season", required=True, type=int, help="Season year")
@click.option("--min-pa", default=50, help="Minimum plate appearances")
def all_re(season, min_pa):
    """Compute RE matrix, linear weights, and player RE24."""
    client = get_client()

    click.echo(f"Step 1/3: Computing RE matrix for {season}...")
    matrix = compute_re_matrix(client, season)
    click.echo(f"  -> {len(matrix)} states")

    click.echo(f"Step 2/3: Deriving linear weights for {season}...")
    weights = compute_linear_weights(client, season, re_matrix=matrix)
    click.echo(f"  -> w1B={weights['w1B']:.3f}, wHR={weights['wHR']:.3f}")

    click.echo(f"Step 3/3: Computing player RE24 for {season} (min PA: {min_pa})...")
    count = compute_player_re24(client, season, re_matrix=matrix, min_pa=min_pa)
    click.echo(f"  -> {count} players")

    click.echo("Done.")
    client.close()


if __name__ == "__main__":
    cli()
