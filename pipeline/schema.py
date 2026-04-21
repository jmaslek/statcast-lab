"""ClickHouse schema definitions for the MLB analytics database."""

import clickhouse_connect


PITCHES_DDL = """
CREATE TABLE IF NOT EXISTS pitches (
    -- Game context
    game_pk UInt32,
    game_date Date,
    game_type LowCardinality(String),
    home_team LowCardinality(String),
    away_team LowCardinality(String),
    inning UInt8,
    inning_topbot LowCardinality(String),

    -- At-bat context
    at_bat_number UInt16,
    pitch_number UInt8,
    batter UInt32,
    pitcher UInt32,
    stand LowCardinality(String),
    p_throws LowCardinality(String),
    balls UInt8,
    strikes UInt8,
    outs_when_up UInt8,
    on_1b Nullable(UInt32),
    on_2b Nullable(UInt32),
    on_3b Nullable(UInt32),
    fielder_2 Nullable(UInt32),

    -- Pitch info
    pitch_type LowCardinality(Nullable(String)),
    pitch_name LowCardinality(Nullable(String)),
    description LowCardinality(String),
    events LowCardinality(Nullable(String)),
    type LowCardinality(String),
    zone Nullable(UInt8),

    -- Pitch physics
    release_speed Nullable(Float32),
    release_spin_rate Nullable(Float32),
    release_extension Nullable(Float32),
    release_pos_x Nullable(Float32),
    release_pos_y Nullable(Float32),
    release_pos_z Nullable(Float32),
    spin_axis Nullable(Float32),
    pfx_x Nullable(Float32),
    pfx_z Nullable(Float32),
    plate_x Nullable(Float32),
    plate_z Nullable(Float32),
    sz_top Nullable(Float32),
    sz_bot Nullable(Float32),
    vx0 Nullable(Float32),
    vy0 Nullable(Float32),
    vz0 Nullable(Float32),
    ax Nullable(Float32),
    ay Nullable(Float32),
    az Nullable(Float32),
    effective_speed Nullable(Float32),

    -- Batted ball
    launch_speed Nullable(Float32),
    launch_angle Nullable(Float32),
    launch_speed_angle Nullable(Float32),
    hit_distance_sc Nullable(Float32),
    hc_x Nullable(Float32),
    hc_y Nullable(Float32),
    barrel Nullable(UInt8),
    babip_value Nullable(Float32),
    iso_value Nullable(Float32),

    -- Expected stats
    estimated_ba_using_speedangle Nullable(Float32),
    estimated_woba_using_speedangle Nullable(Float32),
    estimated_slg_using_speedangle Nullable(Float32),

    -- Scoring
    bat_score Nullable(Int16),
    fld_score Nullable(Int16),
    post_bat_score Nullable(Int16),
    post_fld_score Nullable(Int16),
    delta_run_exp Nullable(Float32),

    -- Win probability
    delta_home_win_exp Nullable(Float32),
    home_win_exp Nullable(Float32),
    bat_win_exp Nullable(Float32),
    delta_pitcher_run_exp Nullable(Float32),

    -- Fielding context
    if_fielding_alignment LowCardinality(Nullable(String)),
    of_fielding_alignment LowCardinality(Nullable(String)),
    hit_location Nullable(UInt8),
    bb_type LowCardinality(Nullable(String)),
    fielder_3 Nullable(UInt32),
    fielder_4 Nullable(UInt32),
    fielder_5 Nullable(UInt32),
    fielder_6 Nullable(UInt32),
    fielder_7 Nullable(UInt32),
    fielder_8 Nullable(UInt32),
    fielder_9 Nullable(UInt32),

    -- Swing tracking
    bat_speed Nullable(Float32),
    swing_length Nullable(Float32),
    attack_angle Nullable(Float32),
    swing_path_tilt Nullable(Float32),
    intercept_ball_minus_batter_pos_x_inches Nullable(Float32),
    intercept_ball_minus_batter_pos_y_inches Nullable(Float32),

    -- Pitcher arm angle
    arm_angle Nullable(Float32),

    -- Break metrics
    api_break_z_with_gravity Nullable(Float32),
    api_break_x_arm Nullable(Float32),
    api_break_x_batter_in Nullable(Float32),

    -- Game context
    n_thruorder_pitcher Nullable(UInt8),
    n_priorpa_thisgame_player_at_bat Nullable(UInt8),

    -- Validation
    woba_value Nullable(Float32),
    woba_denom Nullable(Float32),

    -- Metadata
    des Nullable(String),
    sv_id Nullable(String),
    game_year UInt16
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(game_date)
ORDER BY (game_date, pitcher, batter, at_bat_number, pitch_number)
"""

PLAYERS_DDL = """
CREATE TABLE IF NOT EXISTS players (
    player_id UInt32,
    name_first String,
    name_last String,
    name_full String,
    position LowCardinality(String),
    team LowCardinality(String),
    bat_side LowCardinality(String),
    throw_hand LowCardinality(String),
    birth_date Nullable(Date),
    debut_date Nullable(Date),
    active UInt8
) ENGINE = ReplacingMergeTree()
ORDER BY player_id
"""

TEAMS_DDL = """
CREATE TABLE IF NOT EXISTS teams (
    team_id UInt16,
    team_name String,
    abbreviation LowCardinality(String),
    league LowCardinality(String),
    division LowCardinality(String),
    venue_name String
) ENGINE = ReplacingMergeTree()
ORDER BY team_id
"""

PLAYER_SEASON_HITTING_DDL = """
CREATE TABLE IF NOT EXISTS player_season_hitting (
    batter UInt32,
    season UInt16,
    pa UInt64,
    ab UInt64,
    hits UInt64,
    singles UInt64,
    doubles UInt64,
    triples UInt64,
    home_runs UInt64,
    walks UInt64,
    intent_walks UInt64,
    strikeouts UInt64,
    hbp UInt64,
    sac_flies UInt64,
    total_bases UInt64,
    launch_speed_sum Float64,
    launch_speed_count UInt64,
    launch_angle_sum Float64,
    launch_angle_count UInt64,
    barrel_count UInt64,
    batted_ball_events UInt64,
    hard_hit_count UInt64,
    xba_sum Float64,
    xba_count UInt64,
    xslg_sum Float64,
    xslg_count UInt64,
    xwoba_sum Float64,
    xwoba_count UInt64
) ENGINE = SummingMergeTree()
ORDER BY (batter, season)
"""

PLAYER_SEASON_HITTING_MV_DDL = """
CREATE MATERIALIZED VIEW IF NOT EXISTS player_season_hitting_mv
TO player_season_hitting
AS SELECT
    batter,
    game_year AS season,
    count() AS pa,
    countIf(events IN (
        'single', 'double', 'triple', 'home_run',
        'field_out', 'strikeout', 'double_play', 'force_out',
        'grounded_into_double_play', 'fielders_choice', 'fielders_choice_out',
        'field_error', 'strikeout_double_play', 'triple_play',
        'sac_bunt_double_play'
    )) AS ab,
    countIf(events IN ('single', 'double', 'triple', 'home_run')) AS hits,
    countIf(events = 'single') AS singles,
    countIf(events = 'double') AS doubles,
    countIf(events = 'triple') AS triples,
    countIf(events = 'home_run') AS home_runs,
    countIf(events = 'walk') AS walks,
    countIf(events = 'intent_walk') AS intent_walks,
    countIf(events IN ('strikeout', 'strikeout_double_play')) AS strikeouts,
    countIf(events = 'hit_by_pitch') AS hbp,
    countIf(events = 'sac_fly') AS sac_flies,
    countIf(events = 'single') * 1
        + countIf(events = 'double') * 2
        + countIf(events = 'triple') * 3
        + countIf(events = 'home_run') * 4 AS total_bases,
    ifNull(sumIf(launch_speed, launch_speed IS NOT NULL), 0) AS launch_speed_sum,
    countIf(launch_speed IS NOT NULL) AS launch_speed_count,
    ifNull(sumIf(launch_angle, launch_angle IS NOT NULL), 0) AS launch_angle_sum,
    countIf(launch_angle IS NOT NULL) AS launch_angle_count,
    countIf(barrel = 1) AS barrel_count,
    countIf(launch_speed IS NOT NULL) AS batted_ball_events,
    countIf(launch_speed >= 95) AS hard_hit_count,
    ifNull(sumIf(estimated_ba_using_speedangle, estimated_ba_using_speedangle IS NOT NULL), 0) AS xba_sum,
    countIf(estimated_ba_using_speedangle IS NOT NULL) AS xba_count,
    ifNull(sumIf(estimated_slg_using_speedangle, estimated_slg_using_speedangle IS NOT NULL), 0) AS xslg_sum,
    countIf(estimated_slg_using_speedangle IS NOT NULL) AS xslg_count,
    ifNull(sumIf(estimated_woba_using_speedangle, estimated_woba_using_speedangle IS NOT NULL), 0) AS xwoba_sum,
    countIf(estimated_woba_using_speedangle IS NOT NULL) AS xwoba_count
FROM pitches
WHERE events IS NOT NULL
  AND events != 'truncated_pa'
GROUP BY batter, game_year
"""

PLAYER_SEASON_PITCHING_DDL = """
CREATE TABLE IF NOT EXISTS player_season_pitching (
    pitcher UInt32,
    season UInt16,
    total_pitches UInt64,
    batters_faced UInt64,
    strikeouts UInt64,
    walks UInt64,
    hits_allowed UInt64,
    home_runs_allowed UInt64,
    release_speed_sum Float64,
    release_speed_count UInt64,
    spin_rate_sum Float64,
    spin_rate_count UInt64,
    extension_sum Float64,
    extension_count UInt64,
    whiffs UInt64,
    called_strikes UInt64,
    swings UInt64,
    zone_pitches UInt64
) ENGINE = SummingMergeTree()
ORDER BY (pitcher, season)
"""

PLAYER_SEASON_PITCHING_MV_DDL = """
CREATE MATERIALIZED VIEW IF NOT EXISTS player_season_pitching_mv
TO player_season_pitching
AS SELECT
    pitcher,
    game_year AS season,
    count() AS total_pitches,
    countIf(events IS NOT NULL AND events != 'truncated_pa') AS batters_faced,
    countIf(events IN ('strikeout', 'strikeout_double_play')) AS strikeouts,
    countIf(events = 'walk') AS walks,
    countIf(events IN ('single', 'double', 'triple', 'home_run')) AS hits_allowed,
    countIf(events = 'home_run') AS home_runs_allowed,
    ifNull(sumIf(release_speed, release_speed IS NOT NULL), 0) AS release_speed_sum,
    countIf(release_speed IS NOT NULL) AS release_speed_count,
    ifNull(sumIf(release_spin_rate, release_spin_rate IS NOT NULL), 0) AS spin_rate_sum,
    countIf(release_spin_rate IS NOT NULL) AS spin_rate_count,
    ifNull(sumIf(release_extension, release_extension IS NOT NULL), 0) AS extension_sum,
    countIf(release_extension IS NOT NULL) AS extension_count,
    countIf(description IN (
        'swinging_strike', 'swinging_strike_blocked', 'foul_tip'
    )) AS whiffs,
    countIf(description = 'called_strike') AS called_strikes,
    countIf(description IN (
        'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip',
        'hit_into_play', 'hit_into_play_no_out', 'hit_into_play_score'
    )) AS swings,
    countIf(zone BETWEEN 1 AND 9) AS zone_pitches
FROM pitches
GROUP BY pitcher, game_year
"""


SEASON_RE_MATRIX_DDL = """
CREATE TABLE IF NOT EXISTS season_re_matrix (
    season UInt16,
    base_out_state UInt8,
    outs UInt8,
    runners_on String,
    expected_runs Float64,
    occurrences UInt32
) ENGINE = ReplacingMergeTree()
ORDER BY (season, base_out_state)
"""

SEASON_LINEAR_WEIGHTS_DDL = """
CREATE TABLE IF NOT EXISTS season_linear_weights (
    season UInt16,
    source LowCardinality(String),
    wBB Float64,
    wHBP Float64,
    w1B Float64,
    w2B Float64,
    w3B Float64,
    wHR Float64,
    run_out Float64,
    lg_woba Float64,
    woba_scale Float64,
    lg_r_pa Float64
) ENGINE = ReplacingMergeTree()
ORDER BY (season, source)
"""

PLAYER_SEASON_RE24_DDL = """
CREATE TABLE IF NOT EXISTS player_season_re24 (
    player_id UInt32,
    season UInt16,
    pa UInt32,
    re24 Float64,
    re24_per_pa Float64
) ENGINE = ReplacingMergeTree()
ORDER BY (player_id, season)
"""


SEASON_PARK_FACTORS_DDL = """
CREATE TABLE IF NOT EXISTS season_park_factors (
    season UInt16,
    team LowCardinality(String),
    venue String,
    home_games UInt32,
    road_games UInt32,
    home_rpg Float64,
    road_rpg Float64,
    park_factor Float64
) ENGINE = ReplacingMergeTree()
ORDER BY (season, team)
"""

PITCHER_ARSENAL_DDL = """
CREATE TABLE IF NOT EXISTS pitcher_arsenal (
    pitcher UInt32,
    season UInt16,
    pitch_type LowCardinality(String),
    pitch_name LowCardinality(String),
    pitch_count UInt32,
    usage_pct Float64,
    avg_velo Float64,
    max_velo Float64,
    avg_spin Float64,
    avg_pfx_x Float64,
    avg_pfx_z Float64,
    whiff_pct Float64,
    csw_pct Float64,
    put_away_pct Float64,
    zone_pct Float64,
    chase_pct Float64,
    avg_exit_velo Float64,
    gb_pct Float64
) ENGINE = ReplacingMergeTree()
ORDER BY (pitcher, season, pitch_type)
"""

BATTER_BATTED_BALL_DDL = """
CREATE TABLE IF NOT EXISTS batter_batted_ball (
    batter UInt32,
    season UInt16,
    bbe UInt32,
    gb UInt32,
    fb UInt32,
    ld UInt32,
    popup UInt32,
    pull_count UInt32,
    center_count UInt32,
    oppo_count UInt32,
    sweet_spot UInt32,
    barrel_count UInt32,
    hard_hit_count UInt32,
    avg_la Float64,
    avg_ev Float64,
    max_ev Float64
) ENGINE = ReplacingMergeTree()
ORDER BY (batter, season)
"""

BATTER_PLATOON_DDL = """
CREATE TABLE IF NOT EXISTS batter_platoon_splits (
    batter UInt32,
    season UInt16,
    p_throws LowCardinality(String),
    pa UInt32,
    ab UInt32,
    hits UInt32,
    home_runs UInt32,
    walks UInt32,
    strikeouts UInt32,
    hbp UInt32,
    sac_flies UInt32,
    total_bases UInt32,
    barrel_count UInt32,
    batted_ball_events UInt32,
    hard_hit_count UInt32,
    xwoba_sum Float64,
    xwoba_count UInt32
) ENGINE = ReplacingMergeTree()
ORDER BY (batter, season, p_throws)
"""

PLAYER_SEASON_FRAMING_DDL = """
CREATE TABLE IF NOT EXISTS player_season_framing (
    catcher_id UInt32,
    season UInt16,
    total_called UInt32,
    called_strikes UInt32,
    expected_strikes Float64,
    strikes_above_avg Float64,
    framing_runs Float64
) ENGINE = ReplacingMergeTree()
ORDER BY (catcher_id, season)
"""


ABS_CHALLENGES_DDL = """
CREATE TABLE IF NOT EXISTS abs_challenges (
    season UInt16,
    challenge_type LowCardinality(String),
    entity_name String,
    team_abbr LowCardinality(String),
    total_vs_expected Float64,
    net_for Float64,
    net_against Float64,
    n_challenges UInt32,
    n_overturns UInt32,
    n_confirms UInt32,
    rate_overturns Float64,
    n_strikeouts_flip UInt32,
    n_walks_flip UInt32,
    n_challenges_against UInt32,
    n_overturns_against UInt32,
    rate_overturns_against Nullable(Float64),
    n_strikeouts_flip_against UInt32,
    n_walks_flip_against UInt32
) ENGINE = ReplacingMergeTree()
ORDER BY (season, challenge_type, entity_name, team_abbr)
"""


SEASON_RE_COUNT_MATRIX_DDL = """
CREATE TABLE IF NOT EXISTS season_re_count_matrix (
    season UInt16,
    base_out_state UInt8,
    balls UInt8,
    strikes UInt8,
    expected_runs Float64,
    occurrences UInt32
) ENGINE = ReplacingMergeTree()
ORDER BY (season, base_out_state, balls, strikes)
"""


PLAYER_PERCENTILES_DDL = """
CREATE TABLE IF NOT EXISTS player_percentiles (
    player_id UInt32,
    season UInt16,
    player_type LowCardinality(String),
    stat_name LowCardinality(String),
    stat_value Float64,
    percentile UInt8
) ENGINE = ReplacingMergeTree()
ORDER BY (season, player_type, player_id, stat_name)
"""


ABS_CHALLENGE_EVENTS_DDL = """
CREATE TABLE IF NOT EXISTS abs_challenge_events (
    season UInt16,
    game_pk UInt32,
    play_id String,
    game_date Date,
    event_inning UInt8,
    outs UInt8,
    pre_ball_count UInt8,
    pre_strike_count UInt8,
    batter_name String,
    pitcher_name String,
    catcher_name String,
    bat_team_abbr LowCardinality(String),
    fld_team_abbr LowCardinality(String),
    plate_x Float64,
    plate_z Float64,
    sz_top Float64,
    sz_bot Float64,
    original_is_strike UInt8,
    is_overturned UInt8,
    is_strike3_added UInt8,
    is_strike3_removed UInt8,
    is_ball4_added UInt8,
    is_ball4_removed UInt8,
    is_batter_challenge UInt8,
    is_catcher_challenge UInt8,
    is_pitcher_challenge UInt8,
    edge_dist Float64,
    chal_gained Float64,
    chal_lost Float64
) ENGINE = ReplacingMergeTree()
ORDER BY (season, game_pk, play_id)
"""


GAME_PLAYS_DDL = """
CREATE TABLE IF NOT EXISTS game_plays (
    game_pk UInt32,
    game_date Date,
    season UInt16,
    at_bat_index UInt16,
    inning UInt8,
    half_inning LowCardinality(String),

    -- Matchup
    batter_id UInt32,
    pitcher_id UInt32,
    bat_side LowCardinality(String),
    pitch_hand LowCardinality(String),

    -- Result
    result_type LowCardinality(String),
    event LowCardinality(Nullable(String)),
    event_type LowCardinality(Nullable(String)),
    description String,
    rbi UInt8,
    away_score UInt8,
    home_score UInt8,
    is_out UInt8,

    -- Count at end of PA
    balls UInt8,
    strikes UInt8,
    outs UInt8,

    -- Flags
    is_scoring_play UInt8,
    is_complete UInt8,

    -- Teams
    home_team LowCardinality(String),
    away_team LowCardinality(String)
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(game_date)
ORDER BY (game_pk, at_bat_index)
"""


PLAY_RUNNERS_DDL = """
CREATE TABLE IF NOT EXISTS play_runners (
    game_pk UInt32,
    game_date Date,
    season UInt16,
    at_bat_index UInt16,
    play_event_index UInt16,

    -- Runner
    runner_id UInt32,

    -- Movement
    origin_base LowCardinality(Nullable(String)),
    start_base LowCardinality(Nullable(String)),
    end_base LowCardinality(Nullable(String)),
    is_out UInt8,
    out_base LowCardinality(Nullable(String)),
    out_number Nullable(UInt8),

    -- Event details
    event LowCardinality(Nullable(String)),
    event_type LowCardinality(Nullable(String)),
    movement_reason LowCardinality(Nullable(String)),

    -- Scoring
    is_scoring_event UInt8,
    rbi UInt8,
    earned UInt8,
    team_unearned UInt8,
    responsible_pitcher_id Nullable(UInt32),

    -- Context (denormalized for easy querying)
    inning UInt8,
    half_inning LowCardinality(String),
    batter_id UInt32,
    pitcher_id UInt32
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(game_date)
ORDER BY (game_pk, at_bat_index, runner_id, play_event_index)
"""


def create_plays_tables(client: clickhouse_connect.driver.Client) -> None:
    """Create game_plays and play_runners tables."""
    client.command(GAME_PLAYS_DDL)
    client.command(PLAY_RUNNERS_DDL)


def create_re_count_matrix_table(client: clickhouse_connect.driver.Client) -> None:
    client.command(SEASON_RE_COUNT_MATRIX_DDL)


def create_percentiles_table(client: clickhouse_connect.driver.Client) -> None:
    client.command(PLAYER_PERCENTILES_DDL)


def create_abs_table(client: clickhouse_connect.driver.Client) -> None:
    client.command(ABS_CHALLENGES_DDL)
    client.command(ABS_CHALLENGE_EVENTS_DDL)


def create_batted_ball_table(client: clickhouse_connect.driver.Client) -> None:
    client.command(BATTER_BATTED_BALL_DDL)


def create_platoon_table(client: clickhouse_connect.driver.Client) -> None:
    client.command(BATTER_PLATOON_DDL)


def create_arsenal_table(client: clickhouse_connect.driver.Client) -> None:
    client.command(PITCHER_ARSENAL_DDL)


def create_park_factors_table(client: clickhouse_connect.driver.Client) -> None:
    client.command(SEASON_PARK_FACTORS_DDL)


def create_framing_table(client: clickhouse_connect.driver.Client) -> None:
    client.command(PLAYER_SEASON_FRAMING_DDL)


def create_re_tables(client: clickhouse_connect.driver.Client) -> None:
    """Create run expectancy related tables."""
    client.command(SEASON_RE_MATRIX_DDL)
    client.command(SEASON_LINEAR_WEIGHTS_DDL)
    client.command(PLAYER_SEASON_RE24_DDL)


def create_pitches_table(client: clickhouse_connect.driver.Client) -> None:
    """Create the pitches table if it does not exist."""
    client.command(PITCHES_DDL)


def create_players_table(client: clickhouse_connect.driver.Client) -> None:
    """Create the players table if it does not exist."""
    client.command(PLAYERS_DDL)


def create_teams_table(client: clickhouse_connect.driver.Client) -> None:
    """Create the teams table if it does not exist."""
    client.command(TEAMS_DDL)


def create_materialized_views(client: clickhouse_connect.driver.Client) -> None:
    """Create materialized views and their target tables."""
    client.command(PLAYER_SEASON_HITTING_DDL)
    client.command(PLAYER_SEASON_HITTING_MV_DDL)
    client.command(PLAYER_SEASON_PITCHING_DDL)
    client.command(PLAYER_SEASON_PITCHING_MV_DDL)


def create_all_tables(client: clickhouse_connect.driver.Client) -> None:
    """Create all tables and materialized views in the database."""
    create_pitches_table(client)
    create_players_table(client)
    create_teams_table(client)
    create_materialized_views(client)
    create_framing_table(client)
    create_batted_ball_table(client)
    create_platoon_table(client)
    create_arsenal_table(client)
    create_park_factors_table(client)
    create_re_tables(client)
    create_abs_table(client)
    create_re_count_matrix_table(client)
    create_percentiles_table(client)
    create_plays_tables(client)
