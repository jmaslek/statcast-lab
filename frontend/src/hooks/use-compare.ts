import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";

interface ComparePlayerStats {
  player_id: number;
  name: string;
  position: string;
  team: string;
  season: number;
  hitting: Record<string, number> | null;
  pitching: Record<string, number> | null;
}

interface CompareResponse {
  players: ComparePlayerStats[];
  season: number;
}

export type { ComparePlayerStats, CompareResponse };

export function useCompare(playerIds: number[], season: number) {
  return useQuery({
    queryKey: ["compare", playerIds, season],
    queryFn: () =>
      fetchApi<CompareResponse>("/compare/", {
        players: playerIds.join(","),
        season: String(season),
      }),
    enabled: playerIds.length >= 2,
  });
}
