import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type { HittingLeaderboard, PitchingLeaderboard, FramingLeaderboard, WarLeaderboard, ArsenalData, ExpectedStatsLeaderboard, BattedBallLeaderboard, PlatoonLeaderboard, BaserunningLeaderboard, PitcherBaserunningLeaderboard, AbsLeaderboard, AbsChallengeEventList, BatTrackingLeaderboard } from "@/types/stats";

/** Common pagination params shared by all leaderboard hooks */
interface PaginationParams {
  sort: string;
  desc?: boolean;
  limit: number;
  offset?: number;
  enabled?: boolean;
}

function paginationQuery(params: PaginationParams): Record<string, string> {
  return {
    sort: params.sort,
    desc: String(params.desc ?? true),
    limit: String(params.limit),
    ...(params.offset ? { offset: String(params.offset) } : {}),
  };
}

export function useHittingLeaderboard(params: PaginationParams & {
  season: number;
  minPa: number;
  team?: string;
}) {
  return useQuery({
    queryKey: ["hitting-leaderboard", params],
    queryFn: () =>
      fetchApi<HittingLeaderboard>("/hitting/leaderboard", {
        season: String(params.season),
        min_pa: String(params.minPa),
        ...(params.team ? { team: params.team } : {}),
        ...paginationQuery(params),
      }),
    enabled: params.enabled ?? true,
  });
}

export function useFramingLeaderboard(params: PaginationParams & {
  season: number;
}) {
  return useQuery({
    queryKey: ["framing-leaderboard", params],
    queryFn: () =>
      fetchApi<FramingLeaderboard>("/framing/leaderboard", {
        season: String(params.season),
        ...paginationQuery({ ...params, sort: params.sort || "framing_runs" }),
      }),
    enabled: params.enabled ?? true,
  });
}

export function useWarLeaderboard(params: PaginationParams & {
  season: number;
}) {
  return useQuery({
    queryKey: ["war-leaderboard", params],
    queryFn: () =>
      fetchApi<WarLeaderboard>("/war/leaderboard", {
        season: String(params.season),
        ...paginationQuery({ ...params, sort: params.sort || "war" }),
      }),
    enabled: params.enabled ?? true,
  });
}

export function useArsenalLeaderboard(params: PaginationParams & {
  season: number;
}) {
  return useQuery({
    queryKey: ["arsenal-leaderboard", params],
    queryFn: () =>
      fetchApi<ArsenalData>("/pitching/arsenal", {
        season: String(params.season),
        ...paginationQuery(params),
      }),
    enabled: params.enabled ?? true,
  });
}

export function useExpectedStats(params: PaginationParams & {
  season: number;
  minPa: number;
}) {
  return useQuery({
    queryKey: ["expected-stats", params],
    queryFn: () =>
      fetchApi<ExpectedStatsLeaderboard>("/hitting/expected-stats", {
        season: String(params.season),
        min_pa: String(params.minPa),
        ...paginationQuery(params),
      }),
    enabled: params.enabled ?? true,
  });
}

export function useBattedBallLeaderboard(params: PaginationParams & {
  season: number;
  minBbe: number;
}) {
  return useQuery({
    queryKey: ["batted-ball-leaderboard", params],
    queryFn: () =>
      fetchApi<BattedBallLeaderboard>("/hitting/batted-ball", {
        season: String(params.season),
        min_bbe: String(params.minBbe),
        ...paginationQuery(params),
      }),
    enabled: params.enabled ?? true,
  });
}

export function usePlatoonLeaderboard(params: PaginationParams & {
  season: number;
  minPa: number;
}) {
  return useQuery({
    queryKey: ["platoon-leaderboard", params],
    queryFn: () =>
      fetchApi<PlatoonLeaderboard>("/hitting/platoon", {
        season: String(params.season),
        min_pa: String(params.minPa),
        ...paginationQuery(params),
      }),
    enabled: params.enabled ?? true,
  });
}

export function useBaserunningLeaderboard(params: PaginationParams & {
  season: number;
  minAtt: number;
}) {
  return useQuery({
    queryKey: ["baserunning-leaderboard", params],
    queryFn: () =>
      fetchApi<BaserunningLeaderboard>("/hitting/baserunning", {
        season: String(params.season),
        min_att: String(params.minAtt),
        ...paginationQuery(params),
      }),
    enabled: params.enabled ?? true,
  });
}

export function usePitcherBaserunningLeaderboard(params: PaginationParams & {
  season: number;
  minAtt: number;
}) {
  return useQuery({
    queryKey: ["pitcher-baserunning-leaderboard", params],
    queryFn: () =>
      fetchApi<PitcherBaserunningLeaderboard>("/hitting/baserunning/pitchers", {
        season: String(params.season),
        min_att: String(params.minAtt),
        ...paginationQuery(params),
      }),
    enabled: params.enabled ?? true,
  });
}

export function useAbsLeaderboard(params: PaginationParams & {
  season: number;
  challengeType: string;
}) {
  return useQuery({
    queryKey: ["abs-leaderboard", params],
    queryFn: () =>
      fetchApi<AbsLeaderboard>("/hitting/abs", {
        season: String(params.season),
        challenge_type: params.challengeType,
        ...paginationQuery(params),
      }),
    enabled: params.enabled ?? true,
  });
}

export function useAbsEvents(params: {
  name: string;
  season: number;
  role: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["abs-events", params],
    queryFn: () =>
      fetchApi<AbsChallengeEventList>("/hitting/abs/events", {
        name: params.name,
        season: String(params.season),
        role: params.role,
      }),
    enabled: (params.enabled ?? true) && params.name !== "",
  });
}

export function useBatTrackingLeaderboard(params: PaginationParams & {
  season: number;
  minSwings: number;
}) {
  return useQuery({
    queryKey: ["bat-tracking-leaderboard", params],
    queryFn: () =>
      fetchApi<BatTrackingLeaderboard>("/hitting/bat-tracking", {
        season: String(params.season),
        min_swings: String(params.minSwings),
        ...paginationQuery(params),
      }),
    enabled: params.enabled ?? true,
  });
}

export function usePitchingLeaderboard(params: PaginationParams & {
  season: number;
  minPitches: number;
  team?: string;
}) {
  return useQuery({
    queryKey: ["pitching-leaderboard", params],
    queryFn: () =>
      fetchApi<PitchingLeaderboard>("/pitching/leaderboard", {
        season: String(params.season),
        min_pitches: String(params.minPitches),
        ...(params.team ? { team: params.team } : {}),
        ...paginationQuery(params),
      }),
    enabled: params.enabled ?? true,
  });
}
