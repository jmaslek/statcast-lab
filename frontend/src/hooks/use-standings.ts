import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { STALE_TIME } from "@/lib/constants";

interface TeamRecord {
  team_id: number;
  team_name: string;
  team_abbrev: string;
  wins: number;
  losses: number;
  pct: string;
  gb: string;
  home_record: string;
  away_record: string;
  last_ten: string;
  streak: string;
  runs_scored: number;
  runs_allowed: number;
  run_diff: number;
  division_rank: number;
}

interface DivisionStandings {
  division_name: string;
  league_name: string;
  teams: TeamRecord[];
}

interface StandingsResponse {
  season: number;
  divisions: DivisionStandings[];
}

export type { TeamRecord, DivisionStandings, StandingsResponse };

export function useStandings(season: number) {
  return useQuery({
    queryKey: ["standings", season],
    queryFn: () => fetchApi<StandingsResponse>("/standings/", { season: String(season) }),
    staleTime: STALE_TIME.LIVE,
  });
}
