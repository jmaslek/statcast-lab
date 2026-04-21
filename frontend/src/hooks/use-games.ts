import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { STALE_TIME } from "@/lib/constants";

interface GameSummary {
  game_pk: number;
  game_date: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
}

interface GameListResponse {
  games: GameSummary[];
  date: string;
}

interface PitchDetail {
  at_bat_number: number;
  pitch_number: number;
  inning: number;
  inning_topbot: string;
  pitcher: number;
  pitcher_name: string | null;
  batter: number;
  batter_name: string | null;
  pitch_type: string | null;
  release_speed: number | null;
  description: string;
  events: string | null;
  plate_x: number | null;
  plate_z: number | null;
  launch_speed: number | null;
  launch_angle: number | null;
  home_win_exp: number | null;
}

interface GameDetail {
  game_pk: number;
  game_date: string;
  home_team: string;
  away_team: string;
  pitches: PitchDetail[];
  total_pitches: number;
}

// ---- Boxscore types (from MLB Stats API via backend) ----

interface BoxscoreInning {
  num: number;
  away_runs: number;
  away_hits: number;
  away_errors: number;
  home_runs: number;
  home_hits: number;
  home_errors: number;
}

interface BoxscoreBatter {
  player_id: number;
  name: string;
  position: string;
  batting_order: string | null;
  ab: number;
  r: number;
  h: number;
  rbi: number;
  bb: number;
  k: number;
  avg: string;
  obp: string;
  slg: string;
  summary: string;
}

interface BoxscorePitcher {
  player_id: number;
  name: string;
  ip: string;
  h: number;
  r: number;
  er: number;
  bb: number;
  k: number;
  pitches: number;
  strikes: number;
  era: string;
  summary: string;
  note: string | null;
}

interface BoxscoreTeamTotals {
  runs: number;
  hits: number;
  errors: number;
  lob: number;
}

interface BoxscoreTeam {
  team_name: string;
  batters: BoxscoreBatter[];
  pitchers: BoxscorePitcher[];
  totals: BoxscoreTeamTotals;
}

interface BoxscoreData {
  game_pk: number;
  innings: BoxscoreInning[];
  away: BoxscoreTeam;
  home: BoxscoreTeam;
}

export type {
  GameSummary,
  GameListResponse,
  PitchDetail,
  GameDetail,
  BoxscoreData,
  BoxscoreInning,
  BoxscoreBatter,
  BoxscorePitcher,
  BoxscoreTeam,
  BoxscoreTeamTotals,
};

export function useGameList(date: string) {
  return useQuery({
    queryKey: ["games", date],
    // Empty date → backend returns most recent date with data
    queryFn: () => fetchApi<GameListResponse>("/games/", date ? { date } : {}),
  });
}

export function useGameDetail(gamePk: number | null) {
  return useQuery({
    queryKey: ["game-detail", gamePk],
    queryFn: () => fetchApi<GameDetail>(`/games/${gamePk}`),
    enabled: gamePk !== null,
  });
}

export function useBoxscore(gamePk: number | null) {
  return useQuery({
    queryKey: ["boxscore", gamePk],
    queryFn: () => fetchApi<BoxscoreData>(`/games/${gamePk}/boxscore`),
    enabled: gamePk !== null,
    staleTime: STALE_TIME.LIVE,
  });
}
