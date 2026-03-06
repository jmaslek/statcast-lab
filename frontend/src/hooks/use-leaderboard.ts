import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type { HittingLeaderboard, PitchingLeaderboard, FramingLeaderboard, WarLeaderboard, ArsenalData, ExpectedStatsLeaderboard, BattedBallLeaderboard, PlatoonLeaderboard } from "@/types/stats";

export function useHittingLeaderboard(params: {
  season: number;
  minPa: number;
  team?: string;
  sort: string;
  limit: number;
}) {
  return useQuery({
    queryKey: ["hitting-leaderboard", params],
    queryFn: () =>
      fetchApi<HittingLeaderboard>("/hitting/leaderboard", {
        season: String(params.season),
        min_pa: String(params.minPa),
        sort: params.sort,
        limit: String(params.limit),
        ...(params.team ? { team: params.team } : {}),
      }),
  });
}

export function useFramingLeaderboard(params: {
  season: number;
  limit: number;
}) {
  return useQuery({
    queryKey: ["framing-leaderboard", params],
    queryFn: () =>
      fetchApi<FramingLeaderboard>("/framing/leaderboard", {
        season: String(params.season),
        limit: String(params.limit),
      }),
  });
}

export function useWarLeaderboard(params: {
  season: number;
  limit: number;
}) {
  return useQuery({
    queryKey: ["war-leaderboard", params],
    queryFn: () =>
      fetchApi<WarLeaderboard>("/war/leaderboard", {
        season: String(params.season),
        limit: String(params.limit),
      }),
  });
}

export function useArsenalLeaderboard(params: {
  season: number;
  sort: string;
  limit: number;
}) {
  return useQuery({
    queryKey: ["arsenal-leaderboard", params],
    queryFn: () =>
      fetchApi<ArsenalData>("/pitching/arsenal", {
        season: String(params.season),
        sort: params.sort,
        limit: String(params.limit),
      }),
  });
}

export function useExpectedStats(params: {
  season: number;
  minPa: number;
  sort: string;
  limit: number;
}) {
  return useQuery({
    queryKey: ["expected-stats", params],
    queryFn: () =>
      fetchApi<ExpectedStatsLeaderboard>("/hitting/expected-stats", {
        season: String(params.season),
        min_pa: String(params.minPa),
        sort: params.sort,
        limit: String(params.limit),
      }),
  });
}

export function useBattedBallLeaderboard(params: {
  season: number;
  minBbe: number;
  sort: string;
  limit: number;
}) {
  return useQuery({
    queryKey: ["batted-ball-leaderboard", params],
    queryFn: () =>
      fetchApi<BattedBallLeaderboard>("/hitting/batted-ball", {
        season: String(params.season),
        min_bbe: String(params.minBbe),
        sort: params.sort,
        limit: String(params.limit),
      }),
  });
}

export function usePlatoonLeaderboard(params: {
  season: number;
  minPa: number;
  sort: string;
  limit: number;
}) {
  return useQuery({
    queryKey: ["platoon-leaderboard", params],
    queryFn: () =>
      fetchApi<PlatoonLeaderboard>("/hitting/platoon", {
        season: String(params.season),
        min_pa: String(params.minPa),
        sort: params.sort,
        limit: String(params.limit),
      }),
  });
}

export function usePitchingLeaderboard(params: {
  season: number;
  minPitches: number;
  team?: string;
  sort: string;
  limit: number;
}) {
  return useQuery({
    queryKey: ["pitching-leaderboard", params],
    queryFn: () =>
      fetchApi<PitchingLeaderboard>("/pitching/leaderboard", {
        season: String(params.season),
        min_pitches: String(params.minPitches),
        sort: params.sort,
        limit: String(params.limit),
        ...(params.team ? { team: params.team } : {}),
      }),
  });
}
