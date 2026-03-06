import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

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
  batter: number;
  pitch_type: string | null;
  release_speed: number | null;
  description: string;
  events: string | null;
  plate_x: number | null;
  plate_z: number | null;
  launch_speed: number | null;
  launch_angle: number | null;
}

interface GameDetail {
  game_pk: number;
  game_date: string;
  home_team: string;
  away_team: string;
  pitches: PitchDetail[];
  total_pitches: number;
}

export type { GameSummary, GameListResponse, PitchDetail, GameDetail };

export function useGameList(date: string) {
  return useQuery({
    queryKey: ["games", date],
    queryFn: () => fetchApi<GameListResponse>("/games/", { date }),
    enabled: !!date,
  });
}

export function useGameDetail(gamePk: number | null) {
  return useQuery({
    queryKey: ["game-detail", gamePk],
    queryFn: () => fetchApi<GameDetail>(`/games/${gamePk}`),
    enabled: gamePk !== null,
  });
}
