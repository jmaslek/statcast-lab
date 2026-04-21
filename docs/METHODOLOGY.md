# Methodology

How metrics are computed in this project, where the data comes from, and how our derived values compare to published sources like FanGraphs.

## Data Source

All pitch-level data comes from [Baseball Savant / Statcast](https://baseballsavant.mlb.com/) via the `pybaseball` library. We store every pitch from regular season games with full game context (base-out state, scoring, pitch physics) in ClickHouse.

**Current coverage:** 2020-2026 seasons. ~750K regular season pitches per season, 99.6% coverage on pitch physics columns.

---

## Traditional Batting Stats

Computed in `backend/services/stats.py` from the `player_season_hitting` materialized view.

| Stat | Formula |
|------|---------|
| **AVG** | Hits / AB |
| **OBP** | (H + BB + HBP) / (AB + BB + HBP + SF) |
| **SLG** | Total Bases / AB |
| **OPS** | OBP + SLG |
| **Barrel %** | Barrels / Batted Ball Events * 100 |
| **Hard Hit %** | Batted Balls >= 95 mph / Batted Ball Events * 100 |
| **Avg Exit Velo** | Sum of launch speeds / count of batted balls |

**At-bat definition:** PA that end in a hit, out, fielder's choice, or error. Walks, HBP, sac flies, and sac bunts are PA but not AB.

---

## Traditional Pitching Stats

Also from `backend/services/stats.py`, using the `player_season_pitching` materialized view.

| Stat | Formula |
|------|---------|
| **K%** | Strikeouts / Batters Faced * 100 |
| **BB%** | Walks / Batters Faced * 100 |
| **Whiff %** | Whiffs / Swings * 100 |
| **CSW%** | (Called Strikes + Whiffs) / Total Pitches * 100 |
| **Avg Velo** | Sum of release speeds / count |
| **Avg Spin** | Sum of spin rates / count |

**Whiff definition:** `swinging_strike`, `swinging_strike_blocked`, `foul_tip`.

**Swing definition:** Whiffs plus `foul`, `hit_into_play`, `hit_into_play_no_out`, `hit_into_play_score`.

---

## Run Expectancy (RE24)

Computed in `pipeline/compute/run_expectancy.py`. This is built from first principles using our own Statcast data — we do NOT use Statcast's pre-computed `delta_run_exp` field.

### Base-Out State Encoding

Every plate appearance occurs in one of 24 possible states: 8 base configurations (empty through bases loaded) times 3 out states (0, 1, 2 outs).

We encode this as a single integer 0-23:

```
base_state = 4*(runner_on_3b) + 2*(runner_on_2b) + 1*(runner_on_1b)   -> 0-7
state = base_state * 3 + outs                                          -> 0-23
```

### Computing the RE Matrix

For each plate appearance in a season:

1. Identify the half-inning (`game_pk`, `inning`, `inning_topbot`)
2. Calculate total runs scored in that half-inning: `last PA's post_bat_score - first PA's bat_score`
3. For each PA, compute "runs remaining from here": `total_inning_runs - runs_already_scored_before_this_PA`
4. Group by base-out state and take the mean of runs remaining

This gives the **expected runs** from each of the 24 states. Example values (2024):

| State | Expected Runs |
|-------|--------------|
| 0 outs, bases empty | 0.487 |
| 0 outs, runner on 1st | 0.882 |
| 0 outs, bases loaded | 2.293 |
| 2 outs, bases empty | 0.098 |

Expected runs strictly decrease with more outs for every base configuration.

### Player RE24

For each plate appearance:

```
run_value = RE(post_state) - RE(pre_state) + runs_scored_on_play
```

Where `post_state` is the base-out state facing the next batter. For the last PA of a half-inning (third out), `RE(post_state) = 0`.

A player's RE24 is the sum of `run_value` across all their plate appearances. It measures total runs contributed above what an average hitter would produce in the same situations.

**2024 RE24 leaders** (min 400 PA): Aaron Judge (94.5), Shohei Ohtani (76.7), Juan Soto (71.7), Bobby Witt Jr. (69.1).

---

## Custom Linear Weights

Computed in `pipeline/compute/run_expectancy.py`. Derives wOBA weights from our RE24 matrix rather than using published FanGraphs values.

### Event Categories

Every plate appearance outcome maps to one of 7 categories:

| Category | Statcast Events |
|----------|----------------|
| **1B** | `single` |
| **2B** | `double` |
| **3B** | `triple` |
| **HR** | `home_run` |
| **BB** | `walk` |
| **HBP** | `hit_by_pitch` |
| **OUT** | Everything else (`field_out`, `strikeout`, `double_play`, `force_out`, `grounded_into_double_play`, `fielders_choice`, `sac_fly`, etc.) |

### Deriving Weights

1. Compute the `run_value` for every PA (same formula as RE24 above)
2. Group by event category, take the mean `run_value` for each
3. Subtract the average OUT run value from each category to get "weight above outs"
4. Scale to the OBP scale using `woba_scale = lg_OBP / lg_wOBA_unscaled`
5. Apply the scale factor to get final weights

### Comparison to FanGraphs (2024)

| Weight | Custom | FanGraphs | Difference |
|--------|--------|-----------|------------|
| wBB | 0.707 | 0.696 | +1.6% |
| wHBP | 0.740 | 0.726 | +2.0% |
| w1B | 0.884 | 0.883 | +0.1% |
| w2B | 1.228 | 1.244 | -1.3% |
| w3B | 1.571 | 1.569 | +0.2% |
| wHR | 2.029 | 2.007 | +1.1% |
| wOBA scale | 1.228 | 1.209 | +1.6% |
| lg wOBA | 0.311 | 0.315 | -1.4% |

All weights are within 2% of FanGraphs. Small differences are expected because:
- We don't apply any smoothing or multi-year regression
- IBB handling differs slightly (FanGraphs separates IBB from the weight derivation more aggressively)
- FanGraphs may use slightly different PA filters or event categorization at the margins

---

## wOBA (Weighted On-Base Average)

Computed in `pipeline/compute/woba.py`.

### Formula

```
wOBA = (wBB*(BB-IBB) + wHBP*HBP + w1B*1B + w2B*2B + w3B*3B + wHR*HR) / (AB + BB - IBB + SF + HBP)
```

### Weight Sources

The pipeline supports two weight sources via `--weight-source`:

- **`fangraphs`** (default): Hardcoded published FanGraphs weights (2015-2025). Source: [FanGraphs Guts](https://www.fangraphs.com/guts.aspx?type=cn).
- **`custom`**: Weights derived from our own RE24 matrix (see above). Requires running `compute linear-weights` first.

Both sets of weights are stored in `season_linear_weights` for easy comparison.

### wRC+ (Weighted Runs Created Plus)

Park-adjusted wRC+ measures a hitter's total offensive value on a scale where 100 is league average, adjusting for the run environment of their home park.

```
wRAA/PA = (wOBA - lg_wOBA) / woba_scale
park_adj = lg_R/PA * (1 - PF)
wRC+ = ((wRAA/PA + lg_R/PA + park_adj) / lg_R/PA) * 100
```

Where:
- `lg_R/PA = lg_wOBA / woba_scale` (league runs per PA)
- `PF` = park factor from `season_park_factors` (1.0 = neutral, >1.0 = hitter-friendly)

When park factors are unavailable (e.g., `compute park-factors` hasn't been run), PF defaults to 1.0 and the formula reduces to the non-park-adjusted version.

**Scale:** 100 = league average. 150 = 50% more run production than average. A hitter at Coors Field (PF ~1.20) will see their wRC+ decrease compared to the unadjusted version, reflecting that their home park inflates offense.

**Dependency:** Requires `compute woba` (which reads park factors if available). For full accuracy, run `compute park-factors` before `compute woba`.

---

## FIP (Fielding Independent Pitching)

Computed in `pipeline/compute/fip.py`. Entirely self-derived — no external constants.

### Formula

```
FIP = ((13*HR + 3*(BB+HBP) - 2*K) / IP) + FIP_constant
```

FIP isolates what a pitcher directly controls: strikeouts, walks, hit-by-pitches, and home runs. It strips out defense and luck on balls in play.

### Innings Pitched

We derive IP from outs recorded per pitcher by classifying every PA outcome:

| Outs | Events |
|------|--------|
| 1 out | `field_out`, `strikeout`, `force_out`, `fielders_choice_out`, `sac_fly`, `sac_bunt`, `fielders_choice`, etc. |
| 2 outs | `double_play`, `grounded_into_double_play`, `strikeout_double_play`, `sac_bunt_double_play`, `sac_fly_double_play` |
| 3 outs | `triple_play` |

`IP = total_outs_recorded / 3`

`field_error` and `catcher_interf` are plate appearances but do not record outs, so they are explicitly excluded from the outs bucket.

### FIP Constant

The FIP constant anchors league-average FIP to league-average run prevention:

```
FIP_constant = lg_RA/9 - ((13*lg_HR + 3*(lg_BB+lg_HBP) - 2*lg_K) / lg_IP)
```

**Why RA/9 instead of ERA?** Statcast pitch data doesn't distinguish earned vs unearned runs. We use RA/9 (runs allowed per 9 innings) instead. This means our FIP values are ~0.2-0.3 higher than FanGraphs across the board, but **relative rankings are identical** — the constant shifts everyone equally.

**2024 values:** Our FIP constant = 3.50 (vs FanGraphs ~3.17). The 0.33 gap is exactly the difference between league RA/9 (4.38) and league ERA (~4.05).

### 2024 FIP Leaders (min 140 IP)

| Pitcher | IP | K | HR | FIP |
|---------|-----|-----|-----|------|
| Chris Sale | 175.3 | 225 | 9 | 2.41 |
| Tarik Skubal | 193.3 | 228 | 15 | 2.83 |
| Garrett Crochet | 147.3 | 209 | 18 | 3.03 |
| Logan Webb | 204.3 | 172 | 11 | 3.24 |

---

## Batting WAR (Wins Above Replacement)

Computed in `pipeline/compute/war.py`. Uses wOBA-based offensive value compared to a replacement-level player.

### Formula

```
batting_runs = ((wOBA - lg_wOBA) / woba_scale) * PA
replacement_runs = -0.0333 * PA
WAR = (batting_runs - replacement_runs) / 10.0
```

### Components

| Term | Meaning |
|------|---------|
| **batting_runs** | Runs above average based on wOBA. A player with league-average wOBA has 0 batting_runs. |
| **replacement_runs** | The baseline: a freely available player produces ~20 runs below average over a full season (600 PA). We use -0.0333 runs/PA. |
| **runs_per_win** | Fixed at 10.0 (the standard conversion rate). |

### Simplifications

Our batting WAR omits several adjustments that FanGraphs includes:
- **Baserunning runs** (stolen bases, taking extra bases)
- **Positional adjustment** (SS is harder than 1B)
- **Park factor adjustment** (Coors inflates offense)
- **League adjustment** (AL vs NL differences)
- **Fielding runs** (defensive contribution)

This means our WAR is purely an **offensive value** metric. It will overvalue hitters in hitter-friendly parks and undervalue good defenders.

### Dependency

Requires `compute woba` to run first — batting WAR reads from the `player_woba` table.

---

## Pitching WAR

Computed in `pipeline/compute/war.py`. Uses two complementary methods.

### Method 1: RA9-based WAR

```
RA9 = (runs_allowed / IP) * 9
RA9_WAR = (replacement_RA9 - pitcher_RA9) / 9 * IP / runs_per_win
```

- **Replacement RA/9**: 5.5 (a freely available pitcher allows about 5.5 runs per 9 innings)
- A pitcher with a lower RA/9 than replacement is worth positive WAR

### Method 2: RE24-based WAR

Uses the same run_value framework as batter RE24 but from the pitcher's perspective:

```
pitcher_RE24 = -sum(batter_run_values)    # negative run values are good for pitchers
RE24_WAR = pitcher_RE24 / 10.0
```

This is context-dependent — a strikeout with the bases loaded is worth more than one with bases empty. RA9-WAR treats all innings equally; RE24-WAR captures situational performance.

### Simplifications

Like batting WAR, we omit:
- **Park factor adjustment**
- **FIP-based WAR** (FanGraphs' primary pitching WAR uses FIP instead of RA)
- **Leverage index weighting** for relievers
- **Replacement level calibration** against the actual replacement pool

---

## Catcher Framing

Computed in `pipeline/compute/framing.py`. Measures a catcher's ability to get borderline pitches called as strikes.

### Approach: Location-Based Expected Strike Rate

1. **Normalize pitch location**: Convert each pitch's `plate_x` and `plate_z` into a coordinate system relative to the batter's strike zone:
   - `norm_x = plate_x / 0.8333` (zone half-width in feet)
   - `norm_z = (plate_z - sz_bot) / (sz_top - sz_bot)` (0 = bottom, 1 = top of zone)

2. **Build a grid model**: Divide the normalized space into a 20x20 grid extending well beyond the zone (x: -2.0 to 2.0, z: -0.5 to 1.5). For each cell, compute the league-average called strike rate from all `called_strike` and `ball` pitches.

3. **Per-catcher evaluation**: For each of a catcher's called pitches, look up the expected strike probability from the grid. Sum these to get `expected_strikes`. Compare to actual `called_strikes`:

```
strikes_above_average = called_strikes - expected_strikes
framing_runs = strikes_above_average * 0.125
```

### Constants

| Parameter | Value | Meaning |
|-----------|-------|---------|
| `ZONE_HALF_WIDTH` | 0.8333 ft | Half the width of the strike zone (17 inches / 2, in feet) |
| `GRID_SIZE` | 20 | Resolution of the location grid (20x20 = 400 bins) |
| `RUNS_PER_STRIKE` | 0.125 | Run value of converting a ball to a called strike (~1/8 of a run) |

### Simplifications

- We do not control for pitcher, batter handedness, count, or umpire tendencies. A full model (like Baseball Prospectus's framing metric) includes these as covariates.
- The grid model is a rough approximation of what a GAM or mixed-effects model would provide.
- We evaluate ALL called pitches, not just borderline ones (within ~1 ball width of the zone edge). This means interior pitches (nearly always strikes) dilute the signal slightly.

---

## Park Factors

Computed in `pipeline/compute/park_factors.py`. Measures how much a ballpark inflates or suppresses run scoring compared to league average.

### Formula

```
home_rpg = total_runs_in_home_games / home_games     # both teams' runs
road_rpg = total_runs_in_road_games / road_games     # both teams' runs
raw_pf   = home_rpg / road_rpg
park_factor = 1 + (raw_pf - 1) / 2
```

### The Halving Adjustment

The raw ratio overstates the park effect because the team itself plays in both environments. If Coors Field inflates scoring, the Rockies' own offense benefits at home — but the Rockies also face the same pitching on the road. Only **half** the home/road difference is attributable to the park; the other half is the team's own composition interacting with its schedule.

Dividing the deviation from 1.0 by 2 is the standard adjustment used by FanGraphs and other sources.

### Run Counting

We sum `post_bat_score - bat_score` across all plate appearance outcomes (`events IS NOT NULL`) in regular season games. This captures runs scored on each PA by the batting team. Since we include events from both teams' at-bats in a game, the total represents all runs scored in that game.

Minor caveat: runs that score between plate appearances (e.g., a runner stealing home on a wild pitch that doesn't produce an event) may be missed in the per-PA deltas. In practice this affects fewer than 0.1% of runs.

### Scale

We store park factors on a **1.0 scale** where:
- 1.0 = league-average park
- \>1.0 = hitter-friendly (e.g., Coors Field ~1.20)
- <1.0 = pitcher-friendly (e.g., Oracle Park ~0.95)

To convert to the FanGraphs 100-scale: multiply by 100.

### Comparison to FanGraphs (2025, 1-Year)

| Team | Us (x100) | FanGraphs | Diff |
|------|-----------|-----------|------|
| COL | 120 | 119 | +1 |
| LAD | 109 | 108 | +1 |
| PHI | 105 | 105 | 0 |
| CIN | 103 | 102 | +1 |

Differences of 1-2 points are expected due to pitch-level vs box-score run counting.

---

## Pitcher Arsenal Profiles

Computed in `pipeline/compute/arsenal.py`. Breaks down each pitcher's repertoire into per-pitch-type seasonal aggregates with plate discipline, movement, and batted ball metrics.

### Approach

A single ClickHouse query grouped by `(pitcher, pitch_type)` computes raw counts and aggregates from the `pitches` table. Post-query Polars processing derives percentage metrics from the raw counts.

Only pitch types with at least `min_pitches` (default 50) are included to ensure stable percentages.

### Metrics

| Metric | Formula | Notes |
|--------|---------|-------|
| **Usage %** | Pitch count / pitcher's total pitches * 100 | How often a pitcher throws this pitch |
| **Avg Velo** | `avg(release_speed)` | Mean pitch velocity (mph) |
| **Max Velo** | `max(release_speed)` | Peak pitch velocity (mph) |
| **Avg Spin** | `avg(release_spin_rate)` | Mean spin rate (RPM) |
| **HB (Horizontal Break)** | `avg(pfx_x) * 12` | Horizontal movement in inches (pitcher's perspective) |
| **IVB (Induced Vertical Break)** | `avg(pfx_z) * 12` | Induced vertical break in inches (positive = rise) |
| **Whiff %** | Whiffs / Swings * 100 | Swing-and-miss rate |
| **CSW %** | (Called strikes + whiffs) / Total pitches * 100 | Called strike + whiff rate |
| **Put-away %** | Strikeouts on 2-strike pitches / Two-strike pitches * 100 | Ability to finish at-bats |
| **Zone %** | In-zone pitches / Total pitches * 100 | Zone = Statcast zones 1-9 |
| **Chase %** | Out-of-zone swings / Out-of-zone pitches * 100 | Induced chase rate |
| **Avg EV** | `avgIf(launch_speed, launch_speed IS NOT NULL)` | Exit velocity against this pitch |
| **GB %** | Ground balls / Total batted balls * 100 | Ground ball rate |

### Movement Conversion

Statcast stores `pfx_x` and `pfx_z` in feet. We multiply by 12 to convert to inches, which is the standard unit for pitch movement. These represent the deviation from a theoretical spinless pitch (gravity-only trajectory).

### Definitions

Whiff events: `swinging_strike`, `swinging_strike_blocked`, `foul_tip`

Swing events: Whiff events plus `foul`, `hit_into_play`, `hit_into_play_no_out`, `hit_into_play_score`

Put-away: A pitch thrown with 2 strikes (`strikes = 2`) where the event is `strikeout` or `strikeout_double_play`

---

## Expected Stats (xStats)

Computed on-the-fly in `backend/api/hitting.py` from pre-aggregated data in the `player_season_hitting` materialized view. No dedicated pipeline step — the MV already accumulates `xba_sum`/`xba_count` and `xwoba_sum`/`xwoba_count` from Statcast's `estimated_ba_using_speedangle` and `estimated_woba_using_speedangle` columns.

### Metrics

| Metric | Formula |
|--------|---------|
| **BA** | Hits / AB |
| **xBA** | `xba_sum / xba_count` |
| **BA - xBA** | Actual minus expected — positive = overperforming |
| **wOBA** | From `player_woba` table (see wOBA section above) |
| **xwOBA** | `xwoba_sum / xwoba_count` |
| **wOBA - xwOBA** | Actual minus expected |

**Note on xSLG:** Statcast's `estimated_slg_using_speedangle` column is too sparse to use reliably (zero rows in 2024, <8% population in 2025). We omit xSLG from the expected stats display.

### Interpretation

Expected stats are based on Statcast's machine learning models that predict outcomes from launch speed and launch angle. The actual-vs-expected deltas decompose performance into skill and luck/defense:

- **Positive diff (BA > xBA)**: Player is outperforming expected — may be due to sprint speed, favorable BABIP luck, or defensive positioning
- **Negative diff (BA < xBA)**: Player is underperforming expected — likely to regress upward
- **Large wOBA - xwOBA**: Strongest signal for future regression, as wOBA incorporates all PA outcomes

### Data Source

The `x` columns come from Statcast's `estimated_*_using_speedangle` fields, which are only populated for batted ball events with valid launch speed and angle. The counts (`xba_count`, etc.) reflect how many of a player's PA had valid batted ball data.

---

## Batted Ball Profiles

Computed in `pipeline/compute/batted_ball.py`. Breaks down each batter's batted ball quality: type distribution (GB/FB/LD/popup), spray direction (pull/center/oppo), and quality metrics (sweet spot, hard hit, exit velocity).

### Batted Ball Types

From Statcast's `bb_type` column: `ground_ball`, `fly_ball`, `line_drive`, `popup`. Each expressed as a percentage of total batted ball events (BBE).

### Spray Direction

Uses spray chart coordinates (`hc_x`, `hc_y`) with home plate at approximately (128, 208):

```
spray_angle = atan2(hc_x - 128, 208 - hc_y) * 180 / pi
```

- **Pull**: RHB spray_angle < -15° (left field), LHB spray_angle > 15° (right field)
- **Center**: |spray_angle| <= 15°
- **Oppo**: RHB spray_angle > 15° (right field), LHB spray_angle < -15° (left field)

Uses per-pitch `stand` so switch hitters are classified correctly for each plate appearance.

### Quality Metrics

| Metric | Definition |
|--------|-----------|
| **Sweet Spot %** | Launch angle 8-32° / BBE — the optimal LA range for hits and extra bases |
| **Hard Hit %** | Exit velocity >= 95 mph / BBE |
| **Avg LA** | Mean launch angle (degrees) |
| **Avg EV** | Mean exit velocity (mph) |
| **Max EV** | Peak exit velocity (mph) |

---

## Platoon Splits

Computed in `pipeline/compute/platoon_splits.py`. Measures how batters perform against left-handed vs right-handed pitchers — one of the largest known matchup effects in baseball.

### Approach

Group plate appearances by `(batter, p_throws)` to produce two rows per batter per season: vs LHP and vs RHP. Compute standard batting stats (AVG, OBP, SLG, OPS, K%) and xwOBA for each split.

The API pivots both splits into a single wide row per player with vL and vR columns side by side, plus `ops_diff = OPS(vL) - OPS(vR)` as the platoon magnitude metric.

### Event Classification

Uses the same event-to-outcome mapping as the `player_season_hitting` materialized view (see Traditional Batting Stats above). At-bats include hits, outs, fielder's choices, errors, and double plays. PA also include walks, HBP, sac flies.

### Interpretation

- **Large positive OPS diff** (e.g., +0.200): Player crushes one handedness, struggles against the other — classic platoon candidate
- **Near-zero OPS diff**: No platoon split — player handles both sides equally
- **Negative OPS diff**: Reverse platoon split (uncommon but exists, often for switch hitters)

Typical MLB platoon splits: RHB average ~40 OPS points better vs LHP than RHP. LHB average ~60 OPS points better vs RHP than LHP.

---

## Pipeline Commands

All metrics are computed via the CLI:

```bash
# Traditional stats are computed automatically via ClickHouse materialized views on ingest

# wOBA with FanGraphs weights
uv run mlb compute woba --season 2024

# wOBA with custom weights (must compute linear weights first)
uv run mlb compute woba --season 2024 --weight-source custom

# Run expectancy pipeline (all three steps)
uv run mlb compute all-re --season 2024

# Or individually:
uv run mlb compute re-matrix --season 2024
uv run mlb compute linear-weights --season 2024
uv run mlb compute player-re24 --season 2024 --min-pa 100

# FIP
uv run mlb compute fip --season 2024 --min-ip 50

# WAR
uv run mlb compute batting-war --season 2024 --min-pa 50
uv run mlb compute pitching-war --season 2024 --min-ip 10

# Catcher framing
uv run mlb compute framing --season 2024 --min-called 200

# Park factors
uv run mlb compute park-factors --season 2024

# Pitcher arsenal profiles
uv run mlb compute arsenal --season 2024 --min-pitches 50

# Batted ball profiles
uv run mlb compute batted-ball --season 2024 --min-bbe 25

# Platoon splits
uv run mlb compute platoon-splits --season 2024 --min-pa 30
```

---

## Database Schema

| Table | Engine | Purpose |
|-------|--------|---------|
| `pitches` | MergeTree | Raw Statcast pitch data |
| `players` | ReplacingMergeTree | Player dimension table |
| `teams` | ReplacingMergeTree | Team dimension table |
| `player_season_hitting` | SummingMergeTree | Aggregated batting stats (via materialized view) |
| `player_season_pitching` | SummingMergeTree | Aggregated pitching stats (via materialized view) |
| `player_woba` | ReplacingMergeTree | Per-player wOBA and wRC+ |
| `season_re_matrix` | ReplacingMergeTree | 24 run expectancy values per season |
| `season_linear_weights` | ReplacingMergeTree | Custom and FanGraphs wOBA weights per season |
| `player_season_re24` | ReplacingMergeTree | Per-player RE24 totals |
| `player_fip` | ReplacingMergeTree | Per-pitcher FIP, IP, and components |
| `player_batting_war` | ReplacingMergeTree | Per-player batting WAR and components |
| `player_pitching_war` | ReplacingMergeTree | Per-pitcher RA9-WAR and RE24-WAR |
| `player_season_framing` | ReplacingMergeTree | Per-catcher framing metrics |
| `season_park_factors` | ReplacingMergeTree | Per-team park factors by season |
| `pitcher_arsenal` | ReplacingMergeTree | Per-pitcher, per-pitch-type seasonal aggregates |
| `batter_batted_ball` | ReplacingMergeTree | Per-batter batted ball profiles (type, spray, quality) |
| `batter_platoon_splits` | ReplacingMergeTree | Per-batter stats vs LHP and vs RHP |
| `player_percentiles` | ReplacingMergeTree | Percentile ranks for batters and pitchers |
| `game_plays` | MergeTree | Play-by-play from MLB Stats API |
| `play_runners` | MergeTree | Runner movement events per play |
| `abs_challenges` | ReplacingMergeTree | ABS challenge aggregates |
| `abs_challenge_events` | ReplacingMergeTree | Individual ABS challenge events |

---

## Percentile Rankings

Computed in `pipeline/compute/percentiles.py`. Ranks each batter and pitcher against all qualified players in the same season.

### Batting Percentiles

Metrics ranked: avg exit velo, max exit velo, barrel%, hard hit%, bat speed, swing length, sweet spot%, K%, BB%, whiff%, avg launch angle.

For each metric, the percentile is the percentage of qualified batters that the player exceeds. A 90th percentile in exit velocity means the player hits harder than 90% of qualified batters.

### Pitching Percentiles

Metrics ranked: velocity, max velocity, spin rate, extension, K%, BB%, whiff%, chase%, avg exit velo against.

For pitching metrics where lower is better (exit velo against, BB%), the percentile is inverted so that higher percentile always means better performance.

---

## Bat Tracking Metrics

Queried on-the-fly from the `pitches` table using Statcast's bat tracking columns (`bat_speed`, `swing_length`). Available since the second half of the 2023 season.

| Metric | Definition |
|--------|-----------|
| **Avg Bat Speed** | Average bat speed (mph) at the sweet spot across competitive swings |
| **Max Bat Speed** | Peak bat speed in the season |
| **Avg Swing Length** | Average distance (ft) the bat head travels from start to contact |
| **Fast Swing Rate** | Percentage of swings with bat speed >= 75 mph |
| **Avg Barrel Bat Speed** | Average bat speed on batted balls classified as barrels |

---

## Win Probability (WPA)

Queried on-the-fly from the `pitches` table using Statcast's `home_win_exp` and `delta_home_win_exp` columns. These represent the home team's probability of winning before each pitch and the change in win probability on each pitch.

The WPA chart in the Game Explorer shows `home_win_exp` across all pitches in a game, creating a step chart from the home team's perspective. The area above 50% is shaded for the home team, below 50% for the away team.

**Note:** We use Statcast's pre-computed WPA values rather than deriving our own, since they incorporate a more sophisticated model that accounts for score, inning, base-out state, and run environment.

---

## Pythagorean Win Expectation

Computed on the frontend from standings data (runs scored and runs allowed). Not stored — calculated in real time.

### Formula

```
Expected Win% = RS^x / (RS^x + RA^x)
```

### Exponent Options

The standings page provides a slider to adjust the exponent `x`:

| Exponent | Name | Source |
|----------|------|--------|
| **2.00** | Classic Pythagorean | Bill James' original formulation |
| **1.83** | Pythagenpat | Davenport/Woolner refinement used by FanGraphs |

The slider allows values from 1.50 to 2.50 for exploration. Higher exponents amplify the effect of run differential — teams with lopsided RS/RA ratios see more extreme expected win percentages.
