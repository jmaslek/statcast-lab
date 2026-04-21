export interface Player {
  player_id: number;
  name_full: string;
  position: string;
  team: string;
}

export interface PlayerStats {
  player_id: number;
  season: number;
  hitting?: {
    pa: number;
    ab: number;
    hits: number;
    singles: number;
    doubles: number;
    triples: number;
    home_runs: number;
    walks: number;
    strikeouts: number;
    hbp: number;
    sac_flies: number;
    total_bases: number;
    avg: number;
    obp: number;
    slg: number;
    avg_exit_velo: number | null;
    avg_launch_angle: number | null;
    barrel_pct: number;
    hard_hit_pct: number;
  };
  pitching?: {
    total_pitches: number;
    batters_faced: number;
    strikeouts: number;
    walks: number;
    hits_allowed: number;
    home_runs_allowed: number;
    avg_velo: number | null;
    avg_spin: number | null;
    avg_extension: number | null;
    k_pct: number;
    bb_pct: number;
    whiff_pct: number;
    csw_pct: number;
  };
}

export interface SprayChartPoint {
  hc_x: number;
  hc_y: number;
  events: string;
  launch_speed: number | null;
  launch_angle: number | null;
  bb_type: string | null;
}

export interface ZonePoint {
  plate_x: number;
  plate_z: number;
  description: string;
  pitch_type: string | null;
  release_speed: number | null;
}

export interface MovementPoint {
  pfx_x: number;
  pfx_z: number;
  pitch_type: string;
  pitch_name: string | null;
  release_speed: number | null;
}

export interface LeagueAverageMovement {
  pitch_type: string;
  pitch_name: string | null;
  avg_pfx_x: number;
  avg_pfx_z: number;
  std_pfx_x: number;
  std_pfx_z: number;
  count: number;
}

export interface PitchTypeSummary {
  pitch_type: string;
  pitch_name: string | null;
  usage_pct: number;
  avg_speed: number | null;
  league_avg_speed: number | null;
  count: number;
}

export interface MovementData {
  points: MovementPoint[];
  player_id: number;
  season: number;
  p_throws: string;
  league_averages: LeagueAverageMovement[];
  pitch_summary: PitchTypeSummary[];
}

export interface PitcherMovementSet {
  pitcher_id: number;
  name: string;
  p_throws: string;
  points: MovementPoint[];
  pitch_summary: PitchTypeSummary[];
}

export interface ArsenalComparisonData {
  pitchers: PitcherMovementSet[];
  league_averages: LeagueAverageMovement[];
  season: number;
}

export interface PitchUsageByCountCell {
  pitch_type: string;
  pitch_name: string | null;
  count_state: string;
  usage_pct: number;
  num_pitches: number;
  avg_velo: number | null;
  whiff_pct: number | null;
}

export interface PitchUsageByCountData {
  pitcher_id: number;
  name: string;
  season: number;
  pitch_types: string[];
  pitch_names: Record<string, string>;
  counts: string[];
  cells: PitchUsageByCountCell[];
}

// ---- Game Log types ----

export interface GameLogHittingRow {
  game_date: string;
  opponent: string;
  pa: number;
  ab: number;
  hits: number;
  doubles: number;
  triples: number;
  home_runs: number;
  walks: number;
  strikeouts: number;
  avg: number;
  obp: number;
  slg: number;
}

export interface GameLogPitchingRow {
  game_date: string;
  opponent: string;
  ip: string;
  hits_allowed: number;
  runs: number;
  earned_runs: number;
  walks: number;
  strikeouts: number;
  pitches: number;
  whiff_pct: number | null;
}

export interface GameLogData {
  player_id: number;
  season: number;
  hitting: GameLogHittingRow[];
  pitching: GameLogPitchingRow[];
}

// ---- WPA types ----

export interface WpaPlay {
  at_bat_number: number;
  inning: number;
  inning_topbot: string;
  batter_name: string;
  pitcher_name: string;
  events: string;
  home_win_exp: number | null;
  delta_home_win_exp: number | null;
}

export interface WpaData {
  game_pk: number;
  home_team: string;
  away_team: string;
  plays: WpaPlay[];
}

// ---- Zone Profile types ----

export interface ZoneProfileBin {
  x: number;
  y: number;
  whiff_pct: number | null;
  swing_pct: number | null;
  called_strike_pct: number | null;
  zone_pct: number | null;
  total: number;
}

export interface ZoneProfileData {
  player_id: number;
  season: number;
  role: string;
  bins: ZoneProfileBin[];
}

// ---- Trending types ----

export interface TrendingPlayerRow {
  player_id: number;
  name: string;
  team: string;
  season_pa: number;
  season_ops: number;
  recent_pa: number;
  recent_ops: number;
  ops_delta: number;
  recent_avg: number;
  recent_hr: number;
}

export interface TrendingPlayersData {
  hot: TrendingPlayerRow[];
  cold: TrendingPlayerRow[];
  season: number;
  days: number;
}

export interface RollingDataPoint {
  date: string;
  value: number;
  sample: number;
}

export interface PercentileStat {
  stat_name: string;
  stat_value: number;
  percentile: number;
}

export interface PlayerPercentiles {
  player_id: number;
  season: number;
  batting: PercentileStat[];
  pitching: PercentileStat[];
}

export interface CareerStatcastRow {
  season: number;
  pa: number;
  pitches: number;
  barrel_pct: number | null;
  barrel_pa_pct: number | null;
  exit_velo: number | null;
  max_ev: number | null;
  launch_angle: number | null;
  sweet_spot_pct: number | null;
  hard_hit_pct: number | null;
  xba: number | null;
  xslg: number | null;
  xwoba: number | null;
  k_pct: number | null;
  bb_pct: number | null;
  avg: number | null;
  slg: number | null;
  woba: number | null;
}

export interface CareerStatcastData {
  player_id: number;
  rows: CareerStatcastRow[];
}

export interface CareerPitchingRow {
  season: number;
  pitches: number;
  batters_faced: number;
  avg_velo: number | null;
  max_velo: number | null;
  avg_spin: number | null;
  extension: number | null;
  k_pct: number | null;
  bb_pct: number | null;
  whiff_pct: number | null;
  csw_pct: number | null;
  hard_hit_pct: number | null;
  barrel_pct: number | null;
  xba: number | null;
  xwoba: number | null;
}

export interface CareerPitchingData {
  player_id: number;
  rows: CareerPitchingRow[];
}

export interface RollingStatsData {
  player_id: number;
  season: number;
  stat: string;
  window: number;
  league_avg: number | null;
  data: RollingDataPoint[];
}
