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
