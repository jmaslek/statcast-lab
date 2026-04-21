export interface REMatrixEntry {
  base_out_state: number;
  outs: number;
  runners_on: string;
  expected_runs: number;
  occurrences: number;
}

export interface REMatrixData {
  season: number;
  entries: REMatrixEntry[];
}

export interface LinearWeightsRow {
  season: number;
  source: string;
  wBB: number;
  wHBP: number;
  w1B: number;
  w2B: number;
  w3B: number;
  wHR: number;
  lg_woba: number;
  woba_scale: number;
}

export interface LinearWeightsData {
  season: number;
  weights: LinearWeightsRow[];
}

export interface ParkFactorRow {
  team: string;
  venue: string;
  home_games: number;
  road_games: number;
  home_rpg: number;
  road_rpg: number;
  park_factor: number;
}

export interface ParkFactorsData {
  season: number;
  factors: ParkFactorRow[];
}

export interface RECountEntry {
  base_out_state: number;
  outs: number;
  runners_on: string;
  balls: number;
  strikes: number;
  expected_runs: number;
  occurrences: number;
}

export interface RECountMatrixData {
  season: number;
  entries: RECountEntry[];
}
