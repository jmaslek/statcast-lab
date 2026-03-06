import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type { HittingLeaderboard, PitchingLeaderboard } from "@/types/stats";

// Re-use existing leaderboard endpoints for dashboard snapshots
export function useDashboardHittingLeaders(season: number) {
  return useQuery({
    queryKey: ["dashboard-hitting", season],
    queryFn: () =>
      fetchApi<HittingLeaderboard>("/hitting/leaderboard", {
        season: String(season),
        min_pa: "100",
        sort: "ops",
        limit: "5",
      }),
  });
}

export function useDashboardPitchingLeaders(season: number) {
  return useQuery({
    queryKey: ["dashboard-pitching", season],
    queryFn: () =>
      fetchApi<PitchingLeaderboard>("/pitching/leaderboard", {
        season: String(season),
        min_pitches: "200",
        sort: "k_pct",
        limit: "5",
      }),
  });
}
