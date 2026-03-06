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

### Load Data

```bash
# Backfill a season (takes ~15-30 min per season)
uv run mlb backfill --start 2025-03-27 --end 2025-09-28

# Load player/team metadata
uv run mlb players --season 2025
```

### Compute Metrics

```bash
# Core stats
uv run mlb compute woba --season 2025
uv run mlb compute fip --season 2025

# Run expectancy pipeline (RE matrix -> linear weights -> player RE24)
uv run mlb compute all-re --season 2025

# WAR
uv run mlb compute batting-war --season 2025
uv run mlb compute pitching-war --season 2025

# Advanced
uv run mlb compute arsenal --season 2025
uv run mlb compute batted-ball --season 2025
uv run mlb compute platoon-splits --season 2025
uv run mlb compute framing --season 2025
uv run mlb compute park-factors --season 2025
```

### Run the App

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
