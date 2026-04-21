import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { STALE_TIME } from "@/lib/constants";
import type { Player, PlayerStats, SprayChartPoint, ZonePoint, MovementData, ArsenalComparisonData, RollingStatsData, PlayerPercentiles, CareerStatcastData, CareerPitchingData, PitchUsageByCountData, GameLogData, WpaData, ZoneProfileData, TrendingPlayersData } from "@/types/player";

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

export function useArsenalComparison(
  pitcherIds: number[],
  season: number,
) {
  return useQuery({
    queryKey: ["arsenal-comparison", pitcherIds, season],
    queryFn: () =>
      fetchApi<ArsenalComparisonData>("/pitching/compare-arsenal", {
        pitchers: pitcherIds.join(","),
        season: String(season),
      }),
    enabled: pitcherIds.length >= 2,
  });
}

export function useRollingStats(
  playerId: number | undefined,
  season: number,
  stat: string,
  window: number,
) {
  return useQuery({
    queryKey: ["rolling-stats", playerId, season, stat, window],
    queryFn: () =>
      fetchApi<RollingStatsData>(`/players/${playerId}/rolling`, {
        stat,
        season: String(season),
        window: String(window),
      }),
    enabled: playerId != null,
  });
}

export function useCareerHitting(playerId: number | undefined) {
  return useQuery({
    queryKey: ["career-hitting", playerId],
    queryFn: () => fetchApi<CareerStatcastData>(`/players/${playerId}/career-hitting`),
    enabled: playerId != null,
    staleTime: STALE_TIME.CAREER,
  });
}

export function useCareerPitching(playerId: number | undefined) {
  return useQuery({
    queryKey: ["career-pitching", playerId],
    queryFn: () => fetchApi<CareerPitchingData>(`/players/${playerId}/career-pitching`),
    enabled: playerId != null,
    staleTime: STALE_TIME.CAREER,
  });
}

export function usePitchUsageByCount(playerId: number | undefined, season: number) {
  return useQuery({
    queryKey: ["pitch-usage-count", playerId, season],
    queryFn: () =>
      fetchApi<PitchUsageByCountData>(`/pitching/usage-by-count/${playerId}`, {
        season: String(season),
      }),
    enabled: playerId != null,
  });
}

export function useGameLog(playerId: number | undefined, season: number) {
  return useQuery({
    queryKey: ["game-log", playerId, season],
    queryFn: () => fetchApi<GameLogData>(`/players/${playerId}/game-log`, { season: String(season) }),
    enabled: playerId != null,
  });
}

export function useWpa(gamePk: number | null) {
  return useQuery({
    queryKey: ["wpa", gamePk],
    queryFn: () => fetchApi<WpaData>(`/games/${gamePk}/wpa`),
    enabled: gamePk != null,
  });
}

export function useZoneProfile(playerId: number | undefined, season: number, role: string) {
  return useQuery({
    queryKey: ["zone-profile", playerId, season, role],
    queryFn: () => fetchApi<ZoneProfileData>(`/charts/zone-profile/${playerId}`, { season: String(season), role }),
    enabled: playerId != null,
  });
}

export function useTrending(season: number, days: number = 14) {
  return useQuery({
    queryKey: ["trending", season, days],
    queryFn: () => fetchApi<TrendingPlayersData>(`/players/trending`, { season: String(season), days: String(days) }),
  });
}

export function usePlayerPercentiles(playerId: number | undefined, season: number) {
  return useQuery({
    queryKey: ["player-percentiles", playerId, season],
    queryFn: () =>
      fetchApi<PlayerPercentiles>(`/players/${playerId}/percentiles`, {
        season: String(season),
      }),
    enabled: playerId != null,
    staleTime: STALE_TIME.CAREER, // percentiles are static reference data
  });
}
