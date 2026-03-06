import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type { REMatrixData, LinearWeightsData, ParkFactorsData } from "@/types/analytics";

export function useREMatrix(season: number) {
  return useQuery({
    queryKey: ["re-matrix", season],
    queryFn: () =>
      fetchApi<REMatrixData>("/analytics/re-matrix", {
        season: String(season),
      }),
  });
}

export function useLinearWeights(season: number) {
  return useQuery({
    queryKey: ["linear-weights", season],
    queryFn: () =>
      fetchApi<LinearWeightsData>("/analytics/linear-weights", {
        season: String(season),
      }),
  });
}

export function useParkFactors(season: number) {
  return useQuery({
    queryKey: ["park-factors", season],
    queryFn: () =>
      fetchApi<ParkFactorsData>("/analytics/park-factors", {
        season: String(season),
      }),
  });
}
