export interface SearchPitch {
  game_date: string;
  batter_name: string | null;
  pitcher_name: string | null;
  batter_team: string | null;
  pitcher_team: string | null;
  pitch_type: string | null;
  pitch_name: string | null;
  release_speed: number | null;
  pfx_x: number | null;
  pfx_z: number | null;
  plate_x: number | null;
  plate_z: number | null;
  launch_speed: number | null;
  launch_angle: number | null;
  hit_distance: number | null;
  events: string | null;
  description: string | null;
  zone: number | null;
  stand: string | null;
  p_throws: string | null;
  balls: number;
  strikes: number;
  barrel: number | null;
  estimated_ba: number | null;
  estimated_woba: number | null;
  bat_speed: number | null;
  swing_length: number | null;
}

export interface SearchAggRow {
  player_id: number;
  name: string;
  pitches: number;
  avg_velo: number | null;
  max_velo: number | null;
  avg_launch_speed: number | null;
  avg_launch_angle: number | null;
  barrel_pct: number | null;
  whiff_pct: number | null;
  avg_spin: number | null;
  xba: number | null;
  xwoba: number | null;
  hard_hit_pct: number | null;
}

export interface SearchResult {
  pitches: SearchPitch[] | null;
  aggregated: SearchAggRow[] | null;
  total: number;
  season: number;
  mode: "pitches" | "aggregated";
}

export interface SearchFilters {
  season: number;
  pitch_type?: string;
  batter?: string;
  pitcher?: string;
  batter_team?: string;
  pitcher_team?: string;
  stand?: string;
  p_throws?: string;
  balls?: string;
  strikes?: string;
  events?: string;
  bb_type?: string;
  min_velo?: string;
  max_velo?: string;
  min_ev?: string;
  max_ev?: string;
  min_la?: string;
  max_la?: string;
  barrel?: string;
  zone?: string;
}
