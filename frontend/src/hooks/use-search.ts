import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { STALE_TIME } from "@/lib/constants";
import type { SearchResult, SearchFilters } from "@/types/search";

function filtersToParams(filters: SearchFilters): Record<string, string> {
  const params: Record<string, string> = {
    season: String(filters.season),
  };
  for (const [k, v] of Object.entries(filters)) {
    if (k === "season") continue;
    if (v != null && v !== "" && v !== "all") {
      params[k] = String(v);
    }
  }
  return params;
}

export function useSearchPitches(filters: SearchFilters, enabled: boolean) {
  return useQuery({
    queryKey: ["search-pitches", filters],
    queryFn: () => fetchApi<SearchResult>("/search/pitches", filtersToParams(filters)),
    enabled,
    staleTime: STALE_TIME.SEARCH,
  });
}

export function useSearchAggregate(
  filters: SearchFilters & { group_by?: string; min_pitches?: string; sort?: string },
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["search-aggregate", filters],
    queryFn: () => fetchApi<SearchResult>("/search/aggregate", filtersToParams(filters)),
    enabled,
    staleTime: STALE_TIME.SEARCH,
  });
}
