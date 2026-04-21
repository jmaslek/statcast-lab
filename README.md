# Statcast Labs

I have always been curious about where all of these advanced baseball stats come from. This project is a playground to explore
various sabermetric and advanced stats using pitch-level data from Statcast. With Claude Code, I was able to get a lot of visualizations
and infrastructure set up as well to expose the advanced statistics. I used Baseball Savant as a reference for some visualizations.

In this repository are a couple different layers that have served me well:

## Architecture
Here is how this works right now

```
pybaseball -> Polars -> ClickHouse -> Litestar API -> React + D3.js
```

| Layer | Stack |
|-------|-------|
| **Pipeline** | Python 3.13, Click CLI, Polars, pybaseball |
| **Database** | ClickHouse (Docker) — materialized views for real-time aggregation |
| **Backend** | Litestar, Pydantic v2, clickhouse-connect |
| **Frontend** | React 19, TypeScript, Vite, shadcn/ui, D3.js, TanStack Query |


The frontend was built by my good friend Claude.

## What It Computes

**Batting**: AVG, OBP, SLG, OPS, wOBA, wRC+, xBA, xwOBA, batted ball profiles (launch angle/exit velo distributions, spray direction), platoon splits (vs LHP/RHP)

**Pitching**: K%, BB%, FIP, pitcher arsenal profiles (per-pitch-type velocity, spin, whiff%, CSW%, chase%, put-away%), RA9-WAR, RE24-WAR

**Other**: RE24 matrix from first principles, custom linear weights, park factors, catcher framing, batting WAR

All derived stats are computed from raw Statcast data — no external stat providers required beyond the initial pitch data.

## Quick Start

### Prerequisites

- Python 3.13+
- Node.js 18+ and [yarn](https://yarnpkg.com/)
- Docker (for ClickHouse)
- [uv](https://docs.astral.sh/uv/) (Python package manager)

### Setup

```bash
# Clone and install
git clone https://github.com/<your-username>/mlb-analytics.git
cd mlb-analytics

uv sync
cd frontend && yarn install && cd ..

# Start ClickHouse
docker compose up -d

# Create tables
uv run mlb init-db
```

### Running the pipeline

The pipeline has three layers — ingest (Statcast pitches, rosters, play-by-play,
ABS challenges), compute (everything derived from the raw data), and a daily
catch-up that chains them. For normal use you only need the catch-up:

```bash
# One-shot: detects the last loaded date for the current season and runs
# rosters -> Statcast backfill -> play-by-play -> ABS -> all compute.
# Idempotent — safe to re-run as often as you want.
uv run mlb catch-up

# Limit to a specific season / end date (defaults: current year, yesterday)
uv run mlb catch-up --season 2026 --end 2026-04-21

# Skip the expensive steps if you only want fresh ingest
uv run mlb catch-up --skip-compute
uv run mlb catch-up --skip-abs
```

This is also what you'd wire into cron. For the first-ever load of a historical
season, use `backfill` directly since `catch-up` only pulls forward from the
last loaded date:

```bash
# Backfill a full season (~15-30 min)
uv run mlb backfill --start 2025-03-27 --end 2025-09-28
uv run mlb plays    --season 2025
uv run mlb abs      --season 2025
uv run mlb compute  all --season 2025

# Or recompute every derived metric across a range of seasons
uv run mlb compute all-seasons --start 2020 --end 2025
```

Individual commands are there when you want to iterate on one metric:

| Command | What it does |
|---|---|
| `mlb daily` | Pull yesterday's pitches (smallest possible ingest) |
| `mlb players --season S` | Refresh 40-man rosters and team dimension |
| `mlb plays --season S` | Play-by-play + runner events from MLB Stats API |
| `mlb abs --season S` | ABS challenge leaderboard + recent events |
| `mlb compute all-re --season S` | RE matrix → linear weights → player RE24 |
| `mlb compute woba --season S` | wOBA + park-adjusted wRC+ |
| `mlb compute fip --season S` | FIP against our own RA/9-based constant |
| `mlb compute batting-war --season S` | Batting WAR from wOBA |
| `mlb compute pitching-war --season S` | RA9-WAR and RE24-WAR |
| `mlb compute arsenal --season S` | Pitch-type profiles (velo, spin, whiff%, CSW%, ...) |
| `mlb compute batted-ball --season S` | Launch angle/velo, pull/center/oppo, barrel%, sweet spot% |
| `mlb compute platoon-splits --season S` | Batter stats vs LHP/RHP |
| `mlb compute framing --season S` | Catcher framing runs |
| `mlb compute park-factors --season S` | One-year halved park factors per venue |
| `mlb compute percentiles --season S` | Savant-style 1–99 sliders for batters + pitchers |
| `mlb compute re-count-matrix --season S` | 288-state RE by base-out × count |
| `mlb compute abs-challenges --season S` | Rebuild per-event ABS table from MLB Stats API |

### Run the app

```bash
# Backend (port 8000)
uv run litestar run --host 0.0.0.0 --port 8000

# Frontend (port 5173)
cd frontend && yarn dev
```

Open http://localhost:5173


## Methodology

See [docs/METHODOLOGY.md](docs/METHODOLOGY.md) for detailed documentation on how metrics are computed, including formulas, data sources, and interpretation notes.

## Database

I used this project as a chance to explore ClickHouse, which was built for doing analytical queries super fast. I like what I have seen — materialized views with `SummingMergeTree` handle real-time stat aggregation without any application-layer caching, and `ReplacingMergeTree` with `FINAL` makes the recompute-and-replace pattern clean.

## API Endpoints

I love FastAPI, but I have seen Litestar everywhere on Reddit, so I wanted to see what the fuss was about.  This didn't get me far enough to decide if I like it.

| Endpoint | Description |
|----------|-------------|
| `GET /api/hitting/leaderboard` | Batting leaders with sort/filter |
| `GET /api/hitting/expected-stats` | xBA, xwOBA, over/under-performance |
| `GET /api/hitting/batted-ball` | Batted ball profiles |
| `GET /api/hitting/platoon` | Splits vs LHP/RHP |
| `GET /api/pitching/leaderboard` | Pitching leaders |
| `GET /api/pitching/arsenal` | Arsenal profiles by pitch type |
| `GET /api/pitching/arsenal/{id}` | Single pitcher's arsenal |
| `GET /api/war/leaderboard` | Batting + pitching WAR |
| `GET /api/framing/leaderboard` | Catcher framing |
| `GET /api/players/search` | Player search |
| `GET /api/players/{id}/stats` | Full player season stats |

## Data Sources

Nearly every metric is computed from raw Statcast pitch-level data — no external stat providers beyond the initial data feed. The only exceptions are **xBA** and **xwOBA**, which come from Statcast's pre-computed `estimated_ba_using_speedangle` and `estimated_woba_using_speedangle` fields (a model trained on exit velocity + launch angle).

All other stats — wOBA, wRC+, FIP, WAR, RE24, arsenal profiles, batted ball profiles, platoon splits, framing, park factors — are computed from first principles in the pipeline.

## Roadmap

- **MLB StatsAPI Integration** - Some events aren't present in the statcast data (like steals, or pickoffs etc).  Adding that would allow us to dive deeper.
- **Custom xBA/xwOBA model** - Replace Statcast's black-box expected stats with our own model. The raw inputs (launch speed, launch angle) are already in our database; a 2D kernel regression or Bayesian model over historical batted ball outcomes would give us full control over the expected stats pipeline.
- **Pitch sequencing / Markov models** - Model pitcher tendencies as count-dependent transition matrices between pitch types. Measure sequencing entropy (predictable vs. unpredictable pitchers).

## Known Limitations

- **Barrel data**: The `barrel` column from pybaseball is currently NULL for all rows — barrel% shows 0.0% everywhere. This is a Statcast data feed issue, not a computation bug.
- **xSLG**: `estimated_slg_using_speedangle` is almost entirely unpopulated in Statcast data (<8% for 2025, 0% for 2024). Excluded from all models.
- **ERA vs RA/9**: We use RA/9 (run average) instead of ERA since earned/unearned run classification isn't available at the pitch level.

## License

MIT
