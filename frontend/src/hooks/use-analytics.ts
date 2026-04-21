import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { STALE_TIME } from "@/lib/constants";
import type { REMatrixData, RECountMatrixData, LinearWeightsData, ParkFactorsData } from "@/types/analytics";

export function useREMatrix(season: number) {
  return useQuery({
    queryKey: ["re-matrix", season],
    queryFn: () =>
      fetchApi<REMatrixData>("/analytics/re-matrix", {
        season: String(season),
      }),
    staleTime: STALE_TIME.REFERENCE,
  });
}

export function useRECountMatrix(season: number) {
  return useQuery({
    queryKey: ["re-count-matrix", season],
    queryFn: () =>
      fetchApi<RECountMatrixData>("/analytics/re-count-matrix", {
        season: String(season),
      }),
    staleTime: STALE_TIME.REFERENCE,
  });
}

export function useLinearWeights(season: number) {
  return useQuery({
    queryKey: ["linear-weights", season],
    queryFn: () =>
      fetchApi<LinearWeightsData>("/analytics/linear-weights", {
        season: String(season),
      }),
    staleTime: STALE_TIME.REFERENCE,
  });
}

export function useParkFactors(season: number) {
  return useQuery({
    queryKey: ["park-factors", season],
    queryFn: () =>
      fetchApi<ParkFactorsData>("/analytics/park-factors", {
        season: String(season),
      }),
    staleTime: STALE_TIME.REFERENCE,
  });
}
