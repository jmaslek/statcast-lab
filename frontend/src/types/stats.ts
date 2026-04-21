export interface HittingLeaderRow {
  player_id: number;
  name: string;
  pa: number;
  ab: number;
  hits: number;
  home_runs: number;
  walks: number;
  strikeouts: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  barrel_pct: number;
  avg_exit_velo: number;
  hard_hit_pct: number;
  xba: number | null;
  xwoba: number | null;
  woba: number | null;
  wrc_plus: number | null;
}

export interface HittingLeaderboard {
  players: HittingLeaderRow[];
  season: number;
  total: number;
}

export interface FramingLeaderRow {
  player_id: number;
  name: string;
  total_called: number;
  called_strikes: number;
  strike_rate: number;
  strikes_above_avg: number;
  framing_runs: number;
}

export interface FramingLeaderboard {
  players: FramingLeaderRow[];
  season: number;
  total: number;
}

export interface BattingWarRow {
  player_id: number;
  name: string;
  pa: number;
  woba: number;
  wrc_plus: number;
  batting_runs: number;
  war: number;
}

export interface PitchingWarRow {
  player_id: number;
  name: string;
  ip: number;
  ra9: number;
  ra9_war: number;
  re24: number;
  re24_war: number;
}

export interface WarLeaderboard {
  batting: BattingWarRow[];
  pitching: PitchingWarRow[];
  season: number;
  batting_total?: number;
  pitching_total?: number;
}

export interface PitchingLeaderRow {
  player_id: number;
  name: string;
  total_pitches: number;
  batters_faced: number;
  strikeouts: number;
  walks: number;
  hits_allowed: number;
  home_runs_allowed: number;
  k_pct: number;
  bb_pct: number;
  whiff_pct: number;
  csw_pct: number;
  avg_velo: number;
  avg_spin: number;
}

export interface PitchingLeaderboard {
  players: PitchingLeaderRow[];
  season: number;
  total: number;
}

export interface ArsenalRow {
  pitcher_id: number;
  name: string;
  pitch_type: string;
  pitch_name: string;
  pitch_count: number;
  usage_pct: number;
  avg_velo: number;
  max_velo: number;
  avg_spin: number;
  avg_pfx_x: number;
  avg_pfx_z: number;
  whiff_pct: number;
  csw_pct: number;
  put_away_pct: number;
  zone_pct: number;
  chase_pct: number;
  avg_exit_velo: number | null;
  gb_pct: number;
}

export interface ArsenalData {
  rows: ArsenalRow[];
  season: number;
  total: number;
}

export interface PitcherArsenalData {
  pitcher_id: number;
  name: string;
  pitches: ArsenalRow[];
  season: number;
}

export interface ExpectedStatsRow {
  player_id: number;
  name: string;
  pa: number;
  ba: number;
  xba: number;
  ba_diff: number;
  woba: number | null;
  xwoba: number;
  woba_diff: number | null;
}

export interface ExpectedStatsLeaderboard {
  players: ExpectedStatsRow[];
  season: number;
  total: number;
}

export interface BattedBallRow {
  player_id: number;
  name: string;
  bbe: number;
  gb_pct: number;
  fb_pct: number;
  ld_pct: number;
  popup_pct: number;
  pull_pct: number;
  center_pct: number;
  oppo_pct: number;
  sweet_spot_pct: number;
  barrel_pct: number;
  hard_hit_pct: number;
  avg_la: number;
  avg_ev: number;
  max_ev: number;
}

export interface BattedBallLeaderboard {
  players: BattedBallRow[];
  season: number;
  total: number;
}

export interface PlatoonRow {
  player_id: number;
  name: string;
  pa_vl: number;
  avg_vl: number;
  obp_vl: number;
  slg_vl: number;
  ops_vl: number;
  k_pct_vl: number;
  xwoba_vl: number | null;
  pa_vr: number;
  avg_vr: number;
  obp_vr: number;
  slg_vr: number;
  ops_vr: number;
  k_pct_vr: number;
  xwoba_vr: number | null;
  ops_diff: number;
}

export interface PlatoonLeaderboard {
  players: PlatoonRow[];
  season: number;
  total: number;
}

export interface BaserunningRow {
  player_id: number;
  name: string;
  sb: number;
  cs: number;
  sb_pct: number;
  sb_2b: number;
  sb_3b: number;
  sb_home: number;
  pickoffs: number;
  wp_advances: number;
  pb_advances: number;
  br_runs: number;
}

export interface BaserunningLeaderboard {
  players: BaserunningRow[];
  season: number;
  total: number;
}

export interface PitcherBaserunningRow {
  player_id: number;
  name: string;
  sb_against: number;
  cs_by: number;
  sb_pct_against: number;
  wp: number;
  balk: number;
  pickoff_attempts: number;
  pickoff_outs: number;
}

export interface PitcherBaserunningLeaderboard {
  players: PitcherBaserunningRow[];
  season: number;
  total: number;
}

export interface AbsChallengeRow {
  name: string;
  team: string;
  challenges: number;
  overturns: number;
  confirms: number;
  overturn_pct: number;
  k_flips: number;
  bb_flips: number;
}

export interface AbsLeaderboard {
  rows: AbsChallengeRow[];
  season: number;
  challenge_type: string;
  total: number;
}

export interface AbsChallengeEvent {
  game_pk: number;
  play_id: string;
  game_date: string;
  inning: number;
  outs: number;
  count: string;
  batter_name: string;
  pitcher_name: string;
  catcher_name: string;
  bat_team: string;
  fld_team: string;
  plate_x: number;
  plate_z: number;
  sz_top: number;
  sz_bot: number;
  original_call: string;
  result: string;
  is_overturned: boolean;
  edge_dist: number;
}

export interface AbsChallengeEventList {
  events: AbsChallengeEvent[];
  entity_name: string;
  season: number;
  total: number;
}

// ---- Bat Tracking ----

export interface BatTrackingRow {
  player_id: number;
  name: string;
  swings: number;
  avg_bat_speed: number;
  max_bat_speed: number;
  avg_swing_length: number | null;
  fast_swing_rate: number;
  avg_barrel_bat_speed: number | null;
}

export interface BatTrackingLeaderboard {
  players: BatTrackingRow[];
  season: number;
  total: number;
}
