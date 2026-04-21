from datetime import date, timedelta

import click

from pipeline.compute.arsenal import compute_arsenal_for_season
from pipeline.compute.batted_ball import compute_batted_ball_for_season
from pipeline.compute.fip import compute_fip_for_season
from pipeline.compute.framing import compute_framing_for_season
from pipeline.compute.park_factors import compute_park_factors
from pipeline.compute.percentiles import compute_percentiles_for_season
from pipeline.compute.re_count_matrix import compute_re_count_matrix
from pipeline.compute.platoon_splits import compute_platoon_splits_for_season
from pipeline.compute.run_expectancy import (
    compute_linear_weights,
    compute_player_re24,
    compute_re_matrix,
)
from pipeline.compute.war import compute_batting_war, compute_pitching_war
from pipeline.compute.woba import compute_woba_for_season
from pipeline.compute.abs_challenges import compute_abs_challenges
from pipeline.db import get_client
from pipeline.ingest.abs import load_abs
from pipeline.ingest.plays import load_plays
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
@click.option("--start", required=True, type=click.DateTime(formats=["%Y-%m-%d"]))
@click.option("--end", required=True, type=click.DateTime(formats=["%Y-%m-%d"]))
@click.option("--chunk-days", default=7, show_default=True, type=int)
def backfill(start, end, chunk_days: int) -> None:
    """Historical backfill of Statcast pitches."""
    client = get_client()
    total = fetch_and_load(
        client,
        start=start.date(),
        end=end.date(),
        chunk_days=chunk_days,
    )
    click.echo(f"Backfill complete. Total rows: {total}")


@cli.command("catch-up")
@click.option("--end", default=None, type=click.DateTime(formats=["%Y-%m-%d"]))
@click.option("--season", default=None, type=int)
@click.option("--skip-compute", is_flag=True)
@click.option("--skip-abs", is_flag=True)
def catch_up(end, season: int | None, skip_compute: bool, skip_abs: bool) -> None:
    """Bring the pipeline up to `--end` (default: yesterday) in one shot.

    Detects the last loaded date and runs players → statcast → plays → ABS →
    compute. If the data is already current, ingestion is skipped but ABS
    and compute still re-run so leaderboards stay fresh.
    """
    end_date = end.date() if end else date.today() - timedelta(days=1)
    target_season = season if season is not None else end_date.year

    client = get_client()

    result = client.query(
        "SELECT max(game_date) FROM pitches WHERE game_year = {s:UInt16}",
        parameters={"s": target_season},
    )
    last_loaded = result.first_row[0] if result.result_rows else None

    if last_loaded is None:
        # Nothing ingested yet — kick off at spring training.
        start_date = date(target_season, 2, 20)
        click.echo(f"No data for {target_season}. Starting from {start_date}.")
    else:
        start_date = last_loaded + timedelta(days=1)
        click.echo(f"Last loaded date: {last_loaded}")

    click.echo(f"Target: season={target_season}, end={end_date}")

    need_ingest = start_date <= end_date

    if need_ingest:
        click.echo(f"\n[1/5] Refreshing players/teams for {target_season}...")
        load_teams(client)
        load_players(client, season=target_season)

        click.echo(f"\n[2/5] Backfilling Statcast pitches {start_date} -> {end_date}...")
        total = fetch_and_load(
            client, start=start_date, end=end_date, chunk_days=7,
        )
        click.echo(f"  -> {total} pitch rows")

        click.echo(f"\n[3/5] Loading play-by-play {start_date} -> {end_date}...")
        total_plays, total_runners = load_plays(client, start_date, end_date)
        click.echo(f"  -> {total_plays} plays, {total_runners} runner events")
    else:
        click.echo(f"\n[1-3/5] Already up to date through {last_loaded} — skipping ingestion.")

    if not skip_abs:
        click.echo(f"\n[4/5] Refreshing ABS challenge data for {target_season}...")
        total = load_abs(client, target_season)
        click.echo(f"  -> {total} rows")
    else:
        click.echo("\n[4/5] Skipping ABS (--skip-abs)")

    if not skip_compute:
        click.echo(f"\n[5/5] Computing derived metrics for {target_season}...")
        _compute_all_for_season(client, target_season)
    else:
        click.echo("\n[5/5] Skipping compute (--skip-compute)")

    click.echo("\nCatch-up complete.")
    client.close()


@cli.command()
@click.option(
    "--date", "target_date",
    default=None, type=click.DateTime(formats=["%Y-%m-%d"]),
)
def daily(target_date) -> None:
    """Pull a single day of Statcast data (defaults to yesterday)."""
    day = target_date.date() if target_date else date.today() - timedelta(days=1)
    client = get_client()
    total = fetch_and_load(client, start=day, end=day, chunk_days=1)
    click.echo(f"Daily pull complete for {day}. Total rows: {total}")


@cli.command()
@click.option("--season", required=True, type=int)
def players(season):
    """Refresh players and teams dimension tables."""
    client = get_client()
    load_teams(client)
    load_players(client, season=season)
    click.echo("Done.")
    client.close()


@cli.command()
@click.option("--season", required=True, type=int)
def abs(season):
    """Fetch and load ABS challenge data from Baseball Savant."""
    client = get_client()
    total = load_abs(client, season)
    click.echo(f"ABS data loaded: {total} rows for {season}")
    client.close()


@cli.command("plays")
@click.option("--season", default=None, type=int)
@click.option("--start", default=None, type=click.DateTime(formats=["%Y-%m-%d"]))
@click.option("--end", default=None, type=click.DateTime(formats=["%Y-%m-%d"]))
def plays(season, start, end):
    """Fetch play-by-play. Use --season for a full year or --start/--end.

    Skips games already loaded.
    """
    if season and not start and not end:
        start_date, end_date = date(season, 2, 20), date(season, 11, 5)
    elif start and end:
        start_date, end_date = start.date(), end.date()
    else:
        raise click.UsageError("Provide --season or both --start and --end")

    client = get_client()
    total_plays, total_runners = load_plays(client, start_date, end_date)
    click.echo(
        f"Play-by-play load complete: {total_plays} plays, {total_runners} runner events"
    )
    client.close()


@cli.group()
def compute():
    """Calculate derived metrics."""


def _compute_all_for_season(client, season: int) -> None:
    """Run every compute step for `season` in dependency order.

    RE matrix and linear weights have to come first since WAR, wRC+, and
    RE24 all depend on them.
    """
    click.echo(f"\n=== Derived metrics for {season} ===")

    click.echo(f"[{season}] RE matrix")
    matrix = compute_re_matrix(client, season)
    click.echo(f"  {len(matrix)} states")

    click.echo(f"[{season}] Linear weights")
    weights = compute_linear_weights(client, season, re_matrix=matrix)
    click.echo(f"  w1B={weights['w1B']:.3f}, wHR={weights['wHR']:.3f}")

    steps: list[tuple[str, callable, str]] = [
        ("Player RE24", lambda: compute_player_re24(client, season, re_matrix=matrix), "players"),
        ("wOBA", lambda: compute_woba_for_season(client, season), "players"),
        ("Batting WAR", lambda: compute_batting_war(client, season), "players"),
        ("FIP", lambda: compute_fip_for_season(client, season), "pitchers"),
        ("Pitching WAR", lambda: compute_pitching_war(client, season), "pitchers"),
        ("Arsenal", lambda: compute_arsenal_for_season(client, season), "pitcher-pitches"),
        ("Batted ball", lambda: compute_batted_ball_for_season(client, season), "batters"),
        ("Platoon splits", lambda: compute_platoon_splits_for_season(client, season), "splits"),
        ("Park factors", lambda: compute_park_factors(client, season), "teams"),
        ("Framing", lambda: compute_framing_for_season(client, season), "catchers"),
        ("Percentiles", lambda: compute_percentiles_for_season(client, season), "rows"),
        ("ABS events", lambda: compute_abs_challenges(client, season), "events"),
    ]
    for label, fn, unit in steps:
        click.echo(f"[{season}] {label}")
        click.echo(f"  {fn()} {unit}")

    click.echo(f"[{season}] Done.")


@compute.command("all")
@click.option("--season", required=True, type=int)
def compute_all(season):
    """Run all compute steps for a season in the correct order."""
    client = get_client()
    _compute_all_for_season(client, season)
    client.close()


@compute.command("all-seasons")
@click.option("--start", default=2020, type=int)
@click.option("--end", default=2025, type=int)
def compute_all_seasons(start, end):
    """Run all compute steps for a range of seasons."""
    client = get_client()
    for season in range(start, end + 1):
        _compute_all_for_season(client, season)
    client.close()


@compute.command()
@click.option("--season", required=True, type=int)
@click.option("--min-pa", default=50)
@click.option(
    "--weight-source",
    type=click.Choice(["fangraphs", "custom"]),
    default="fangraphs",
    show_default=True,
)
def woba(season, min_pa, weight_source):
    """wOBA + park-adjusted wRC+."""
    client = get_client()
    count = compute_woba_for_season(client, season, min_pa, weight_source=weight_source)
    click.echo(f"Computed wOBA for {count} players in {season} (source: {weight_source})")
    client.close()


@compute.command("batting-war")
@click.option("--season", required=True, type=int)
@click.option("--min-pa", default=50)
def batting_war(season, min_pa):
    """Compute batting WAR for all qualifying hitters."""
    client = get_client()
    count = compute_batting_war(client, season, min_pa=min_pa)
    click.echo(f"Computed batting WAR for {count} players in {season}")
    client.close()


@compute.command("pitching-war")
@click.option("--season", required=True, type=int)
@click.option("--min-ip", default=10.0)
def pitching_war(season, min_ip):
    """Compute pitching WAR (RA9-based and RE24-based)."""
    client = get_client()
    count = compute_pitching_war(client, season, min_ip=min_ip)
    click.echo(f"Computed pitching WAR for {count} pitchers in {season}")
    client.close()


@compute.command("fip")
@click.option("--season", required=True, type=int)
@click.option("--min-ip", default=10.0)
def fip(season, min_ip):
    """Compute FIP for all qualifying pitchers."""
    client = get_client()
    count = compute_fip_for_season(client, season, min_ip=min_ip)
    click.echo(f"Computed FIP for {count} pitchers in {season}")
    client.close()


@compute.command("framing")
@click.option("--season", required=True, type=int)
@click.option("--min-called", default=200, show_default=True)
def framing(season, min_called):
    """Compute catcher framing metrics for a season."""
    client = get_client()
    count = compute_framing_for_season(client, season, min_called=min_called)
    click.echo(f"Computed framing for {count} catchers in {season}")
    client.close()


@compute.command("re-matrix")
@click.option("--season", required=True, type=int)
def re_matrix(season):
    """Compute RE24 matrix for a season from game data."""
    client = get_client()
    matrix = compute_re_matrix(client, season)
    click.echo(f"Computed RE matrix with {len(matrix)} states for {season}")
    client.close()


@compute.command("linear-weights")
@click.option("--season", required=True, type=int)
def linear_weights(season):
    """Derive custom linear weights from RE24 matrix."""
    client = get_client()
    weights = compute_linear_weights(client, season)
    click.echo(f"Custom linear weights for {season}:")
    for k, v in weights.items():
        click.echo(f"  {k}: {v:.4f}")
    client.close()


@compute.command("player-re24")
@click.option("--season", required=True, type=int)
@click.option("--min-pa", default=50)
def player_re24(season, min_pa):
    """Compute per-player RE24 for a season."""
    client = get_client()
    count = compute_player_re24(client, season, min_pa=min_pa)
    click.echo(f"Computed RE24 for {count} players in {season}")
    client.close()


@compute.command("arsenal")
@click.option("--season", required=True, type=int)
@click.option("--min-pitches", default=50, show_default=True)
def arsenal(season, min_pitches):
    """Compute pitcher arsenal profiles for a season."""
    client = get_client()
    count = compute_arsenal_for_season(client, season, min_pitches=min_pitches)
    click.echo(
        f"Computed arsenal profiles: {count} pitcher-pitch_type rows in {season}"
    )
    client.close()


@compute.command("batted-ball")
@click.option("--season", required=True, type=int)
@click.option("--min-bbe", default=25, show_default=True)
def batted_ball(season, min_bbe):
    """Compute batted ball profiles for all qualifying hitters."""
    client = get_client()
    count = compute_batted_ball_for_season(client, season, min_bbe=min_bbe)
    click.echo(f"Computed batted ball profiles for {count} batters in {season}")
    client.close()


@compute.command("platoon-splits")
@click.option("--season", required=True, type=int)
@click.option("--min-pa", default=30, show_default=True)
def platoon_splits(season, min_pa):
    """Compute platoon splits for all qualifying hitters."""
    client = get_client()
    count = compute_platoon_splits_for_season(client, season, min_pa=min_pa)
    click.echo(f"Computed platoon splits: {count} batter-split rows in {season}")
    client.close()


@compute.command("park-factors")
@click.option("--season", required=True, type=int)
def park_factors(season):
    """Compute park factors for each team's home venue."""
    client = get_client()
    count = compute_park_factors(client, season)
    click.echo(f"Computed park factors for {count} teams in {season}")
    client.close()


@compute.command("re-count-matrix")
@click.option("--season", required=True, type=int)
def re_count_matrix(season):
    """Compute count-level run expectancy matrix (288 states)."""
    client = get_client()
    count = compute_re_count_matrix(client, season)
    click.echo(f"Computed {count} count-level RE states for {season}")
    client.close()


@compute.command("percentiles")
@click.option("--season", required=True, type=int)
def percentiles(season):
    """Compute percentile ranks for all batters and pitchers."""
    client = get_client()
    count = compute_percentiles_for_season(client, season)
    click.echo(f"Computed {count} percentile rows for {season}")
    client.close()


@compute.command("abs-challenges")
@click.option("--season", required=True, type=int)
def abs_challenges_cmd(season):
    """Build ABS challenge events from game_plays + MLB API pitch data."""
    client = get_client()
    count = compute_abs_challenges(client, season)
    click.echo(f"Computed {count} ABS challenge events for {season}")
    client.close()


@compute.command("all-re")
@click.option("--season", required=True, type=int)
@click.option("--min-pa", default=50)
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
