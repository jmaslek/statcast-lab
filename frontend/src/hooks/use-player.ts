import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type { Player, PlayerStats, SprayChartPoint, ZonePoint, MovementData } from "@/types/player";

export function usePlayer(playerId: number | undefined) {
  return useQuery({
    queryKey: ["player", playerId],
    queryFn: () => fetchApi<Player>(`/players/${playerId}`),
    enabled: playerId != null,
  });
}

export function usePlayerStats(playerId: number | undefined, season: number) {
  return useQuery({
    queryKey: ["player-stats", playerId, season],
    queryFn: () =>
      fetchApi<PlayerStats>(`/players/${playerId}/stats`, {
        season: String(season),
      }),
    enabled: playerId != null,
  });
}

export function useSprayChart(playerId: number | undefined, season: number) {
  return useQuery({
    queryKey: ["spray-chart", playerId, season],
    queryFn: () =>
      fetchApi<{ points: SprayChartPoint[]; player_id: number; season: number }>(
        `/charts/spray/${playerId}`,
        { season: String(season) },
      ),
    enabled: playerId != null,
  });
}

export function useStrikeZone(
  playerId: number | undefined,
  season: number,
  role: "batter" | "pitcher" = "batter",
) {
  return useQuery({
    queryKey: ["strike-zone", playerId, season, role],
    queryFn: () =>
      fetchApi<{ points: ZonePoint[]; player_id: number; season: number }>(
        `/charts/zone/${playerId}`,
        { season: String(season), role },
      ),
    enabled: playerId != null,
  });
}

export function usePitchMovement(playerId: number | undefined, season: number) {
  return useQuery({
    queryKey: ["pitch-movement", playerId, season],
    queryFn: () =>
      fetchApi<MovementData>(
        `/charts/movement/${playerId}`,
        { season: String(season) },
      ),
    enabled: playerId != null,
  });
}
