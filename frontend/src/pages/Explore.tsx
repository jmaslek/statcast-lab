import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type { ColumnDef } from "@tanstack/react-table";
import { QueryError } from "@/components/QueryError";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { fmtAvg, fmtPct, fmtDec1, fmtNullableAvg, fmtDiff, diffColor } from "@/lib/format";
import { SEASONS, DEFAULT_SEASON, TEAMS } from "@/lib/constants";
import {
  useHittingLeaderboard,
  usePitchingLeaderboard,
  useFramingLeaderboard,
  useWarLeaderboard,
  useArsenalLeaderboard,
  useExpectedStats,
  useBattedBallLeaderboard,
  usePlatoonLeaderboard,
  useBaserunningLeaderboard,
  usePitcherBaserunningLeaderboard,
  useBatTrackingLeaderboard,
} from "@/hooks/use-leaderboard";
import { useTrending } from "@/hooks/use-player";
import type { HittingLeaderRow, PitchingLeaderRow, FramingLeaderRow, BattingWarRow, PitchingWarRow, ArsenalRow, ExpectedStatsRow, BattedBallRow, PlatoonRow, BaserunningRow, PitcherBaserunningRow, BatTrackingRow } from "@/types/stats";

// ---- Player search ----

interface PlayerSearchResult {
  results: {
    player_id: number;
    name_full: string;
    position: string;
    team: string;
  }[];
  total: number;
}

function PlayerSearch() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const searchQuery = useQuery({
    queryKey: ["player-search", debouncedSearch],
    queryFn: () =>
      fetchApi<PlayerSearchResult>("/players/search", {
        q: debouncedSearch,
        limit: "10",
      }),
    enabled: debouncedSearch.length >= 2,
  });

  const results = searchQuery.data?.results ?? [];

  return (
    <Command shouldFilter={false} className="rounded-lg border">
      <CommandInput
        placeholder="Search for a player..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {debouncedSearch.length < 2 ? null : searchQuery.isLoading ? (
          <CommandEmpty>Searching...</CommandEmpty>
        ) : results.length === 0 ? (
          <CommandEmpty>No players found.</CommandEmpty>
        ) : (
          <CommandGroup heading="Players">
            {results.map((player) => (
              <CommandItem
                key={player.player_id}
                value={String(player.player_id)}
                onSelect={() => {
                  navigate(`/players/${player.player_id}`);
                  setSearch("");
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium">{player.name_full}</span>
                  <span className="text-xs text-muted-foreground">
                    {player.position} - {player.team}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}

// ---- Column definitions (carried over from Leaderboard) ----

function nameCell(row: { original: { player_id: number; name: string } }) {
  return (
    <Link
      to={`/players/${row.original.player_id}`}
      className="text-primary underline-offset-4 hover:underline font-medium"
    >
      {row.original.name}
    </Link>
  );
}

const hittingColumns: ColumnDef<HittingLeaderRow, unknown>[] = [
  { accessorKey: "name", header: "Name", enableSorting: false, cell: ({ row }) => nameCell(row) },
  { accessorKey: "pa", header: "PA" },
  { accessorKey: "avg", header: "AVG", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "obp", header: "OBP", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "slg", header: "SLG", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "ops", header: "OPS", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "woba", header: "wOBA", cell: ({ getValue }) => fmtNullableAvg(getValue() as number | null) },
  { accessorKey: "wrc_plus", header: "wRC+", cell: ({ getValue }) => { const v = getValue() as number | null; return v != null ? Math.round(v) : "—"; } },
  { accessorKey: "xba", header: "xBA", cell: ({ getValue }) => fmtNullableAvg(getValue() as number | null) },
  { accessorKey: "xwoba", header: "xwOBA", cell: ({ getValue }) => fmtNullableAvg(getValue() as number | null) },
  { accessorKey: "home_runs", header: "HR" },
  { accessorKey: "walks", header: "BB" },
  { accessorKey: "strikeouts", header: "K" },
  { accessorKey: "barrel_pct", header: "Barrel%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "avg_exit_velo", header: "EV", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "hard_hit_pct", header: "HardHit%", cell: ({ getValue }) => fmtPct(getValue() as number) },
];

const pitchingColumns: ColumnDef<PitchingLeaderRow, unknown>[] = [
  { accessorKey: "name", header: "Name", enableSorting: false, cell: ({ row }) => nameCell(row) },
  { accessorKey: "total_pitches", header: "Pitches" },
  { accessorKey: "batters_faced", header: "BF" },
  { accessorKey: "k_pct", header: "K%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "bb_pct", header: "BB%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "whiff_pct", header: "Whiff%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "csw_pct", header: "CSW%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "avg_velo", header: "Velo", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "avg_spin", header: "Spin", cell: ({ getValue }) => Math.round(getValue() as number) },
];

const framingColumns: ColumnDef<FramingLeaderRow, unknown>[] = [
  { accessorKey: "name", header: "Name", enableSorting: false, cell: ({ row }) => nameCell(row) },
  { accessorKey: "total_called", header: "Called Pitches" },
  { accessorKey: "called_strikes", header: "Called Strikes" },
  { accessorKey: "strike_rate", header: "Strike Rate%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "strikes_above_avg", header: "Strikes Above Avg", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "framing_runs", header: "Framing Runs", cell: ({ getValue }) => fmtDec1(getValue() as number) },
];

const battingWarColumns: ColumnDef<BattingWarRow, unknown>[] = [
  { accessorKey: "name", header: "Name", enableSorting: false, cell: ({ row }) => nameCell(row) },
  { accessorKey: "pa", header: "PA" },
  { accessorKey: "woba", header: "wOBA", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "wrc_plus", header: "wRC+", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "batting_runs", header: "Bat Runs", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "war", header: "bWAR", cell: ({ getValue }) => fmtDec1(getValue() as number) },
];

const pitchingWarColumns: ColumnDef<PitchingWarRow, unknown>[] = [
  { accessorKey: "name", header: "Name", enableSorting: false, cell: ({ row }) => nameCell(row) },
  { accessorKey: "ip", header: "IP", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "ra9", header: "RA/9", cell: ({ getValue }) => (getValue() as number).toFixed(2) },
  { accessorKey: "ra9_war", header: "RA9-WAR", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "re24", header: "RE24", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "re24_war", header: "RE24-WAR", cell: ({ getValue }) => fmtDec1(getValue() as number) },
];

function arsenalNameCell(row: { original: ArsenalRow }) {
  return (
    <Link
      to={`/players/${row.original.pitcher_id}`}
      className="text-primary underline-offset-4 hover:underline font-medium"
    >
      {row.original.name}
    </Link>
  );
}

const arsenalColumns: ColumnDef<ArsenalRow, unknown>[] = [
  { accessorKey: "name", header: "Pitcher", enableSorting: false, cell: ({ row }) => arsenalNameCell(row) },
  { accessorKey: "pitch_name", header: "Pitch", enableSorting: false },
  { accessorKey: "pitch_count", header: "Count" },
  { accessorKey: "usage_pct", header: "Usage%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "avg_velo", header: "Velo", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "max_velo", header: "Max", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "avg_spin", header: "Spin", cell: ({ getValue }) => Math.round(getValue() as number) },
  { accessorKey: "avg_pfx_x", header: "HB\"", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "avg_pfx_z", header: "IVB\"", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "whiff_pct", header: "Whiff%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "csw_pct", header: "CSW%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "put_away_pct", header: "PutAway%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "zone_pct", header: "Zone%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "chase_pct", header: "Chase%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "avg_exit_velo", header: "EV", cell: ({ getValue }) => { const v = getValue() as number | null; return v != null ? fmtDec1(v) : "—"; } },
  { accessorKey: "gb_pct", header: "GB%", cell: ({ getValue }) => fmtPct(getValue() as number) },
];

function xstatsNameCell(row: { original: ExpectedStatsRow }) {
  return (
    <Link to={`/players/${row.original.player_id}`} className="text-primary underline-offset-4 hover:underline font-medium">
      {row.original.name}
    </Link>
  );
}

const expectedStatsColumns: ColumnDef<ExpectedStatsRow, unknown>[] = [
  { accessorKey: "name", header: "Name", enableSorting: false, cell: ({ row }) => xstatsNameCell(row) },
  { accessorKey: "pa", header: "PA" },
  { accessorKey: "ba", header: "BA", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "xba", header: "xBA", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "ba_diff", header: "BA-xBA", cell: ({ getValue }) => { const v = getValue() as number; return <span className={diffColor(v)}>{fmtDiff(v)}</span>; } },
  { accessorKey: "woba", header: "wOBA", cell: ({ getValue }) => fmtNullableAvg(getValue() as number | null) },
  { accessorKey: "xwoba", header: "xwOBA", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "woba_diff", header: "wOBA-xwOBA", cell: ({ getValue }) => { const v = getValue() as number | null; if (v == null) return "—"; return <span className={diffColor(v)}>{fmtDiff(v)}</span>; } },
];

const battedBallColumns: ColumnDef<BattedBallRow, unknown>[] = [
  { accessorKey: "name", header: "Name", enableSorting: false, cell: ({ row }) => nameCell(row) },
  { accessorKey: "bbe", header: "BBE" },
  { accessorKey: "gb_pct", header: "GB%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "fb_pct", header: "FB%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "ld_pct", header: "LD%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "popup_pct", header: "PU%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "pull_pct", header: "Pull%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "center_pct", header: "Cent%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "oppo_pct", header: "Oppo%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "sweet_spot_pct", header: "Sweet%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "barrel_pct", header: "Barrel%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "hard_hit_pct", header: "HardHit%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "avg_la", header: "AvgLA", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "avg_ev", header: "AvgEV", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "max_ev", header: "MaxEV", cell: ({ getValue }) => fmtDec1(getValue() as number) },
];

const platoonColumns: ColumnDef<PlatoonRow, unknown>[] = [
  { accessorKey: "name", header: "Name", enableSorting: false, cell: ({ row }) => nameCell(row) },
  { accessorKey: "pa_vl", header: "PA(vL)" },
  { accessorKey: "avg_vl", header: "AVG(vL)", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "obp_vl", header: "OBP(vL)", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "slg_vl", header: "SLG(vL)", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "ops_vl", header: "OPS(vL)", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "k_pct_vl", header: "K%(vL)", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "xwoba_vl", header: "xwOBA(vL)", cell: ({ getValue }) => fmtNullableAvg(getValue() as number | null) },
  { accessorKey: "pa_vr", header: "PA(vR)" },
  { accessorKey: "avg_vr", header: "AVG(vR)", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "obp_vr", header: "OBP(vR)", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "slg_vr", header: "SLG(vR)", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "ops_vr", header: "OPS(vR)", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "k_pct_vr", header: "K%(vR)", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "xwoba_vr", header: "xwOBA(vR)", cell: ({ getValue }) => fmtNullableAvg(getValue() as number | null) },
  { accessorKey: "ops_diff", header: "OPS Diff", cell: ({ getValue }) => { const v = getValue() as number; return <span className={diffColor(v)}>{fmtDiff(v)}</span>; } },
];

const baserunningColumns: ColumnDef<BaserunningRow, unknown>[] = [
  { accessorKey: "name", header: "Name", enableSorting: false, cell: ({ row }) => nameCell(row) },
  { accessorKey: "sb", header: "SB" },
  { accessorKey: "cs", header: "CS" },
  { accessorKey: "sb_pct", header: "SB%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "sb_2b", header: "SB 2B" },
  { accessorKey: "sb_3b", header: "SB 3B" },
  { accessorKey: "sb_home", header: "SB Home" },
  { accessorKey: "pickoffs", header: "PO" },
  { accessorKey: "wp_advances", header: "WP Adv" },
  { accessorKey: "pb_advances", header: "PB Adv" },
  { accessorKey: "br_runs", header: "BR Runs", cell: ({ getValue }) => fmtDec1(getValue() as number) },
];

const pitcherBaserunningColumns: ColumnDef<PitcherBaserunningRow, unknown>[] = [
  { accessorKey: "name", header: "Name", enableSorting: false, cell: ({ row }) => nameCell(row) },
  { accessorKey: "sb_against", header: "SB Against" },
  { accessorKey: "cs_by", header: "CS By" },
  { accessorKey: "sb_pct_against", header: "SB% Against", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "wp", header: "WP" },
  { accessorKey: "balk", header: "BK" },
  { accessorKey: "pickoff_attempts", header: "PO Att" },
  { accessorKey: "pickoff_outs", header: "PO Outs" },
];

const batTrackingColumns: ColumnDef<BatTrackingRow, unknown>[] = [
  { accessorKey: "name", header: "Name", enableSorting: false, cell: ({ row }) => nameCell(row) },
  { accessorKey: "swings", header: "Swings" },
  { accessorKey: "avg_bat_speed", header: "Avg Bat Speed", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "max_bat_speed", header: "Max Bat Speed", cell: ({ getValue }) => fmtDec1(getValue() as number) },
  { accessorKey: "avg_swing_length", header: "Swing Length", cell: ({ getValue }) => { const v = getValue() as number | null; return v != null ? fmtDec1(v) : "—"; } },
  { accessorKey: "fast_swing_rate", header: "Fast Swing%", cell: ({ getValue }) => fmtPct(getValue() as number) },
  { accessorKey: "avg_barrel_bat_speed", header: "Barrel Speed", cell: ({ getValue }) => { const v = getValue() as number | null; return v != null ? fmtDec1(v) : "—"; } },
];

// ---- Trending component ----

function TrendingSection({ season }: { season: number }) {
  const trending = useTrending(season, 14);

  if (trending.isLoading) return <Skeleton className="h-32 w-full" />;
  if (!trending.data?.hot.length && !trending.data?.cold.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {trending.data?.hot.length ? (
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-2"><span aria-hidden="true">▲ </span>Heating Up (14 days)</h3>
          <div className="space-y-1.5">
            {trending.data.hot.slice(0, 5).map((p) => (
              <Link key={p.player_id} to={`/players/${p.player_id}`} className="flex items-center justify-between hover:bg-muted/50 rounded px-2 py-1 -mx-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.team}</span>
                </div>
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  <span>{fmtAvg(p.recent_avg)} AVG</span>
                  <span>{p.recent_hr} HR</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span aria-hidden="true">▲</span> +{(p.ops_delta * 1000).toFixed(0)} OPS pts
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {trending.data?.cold.length ? (
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-400 mb-2"><span aria-hidden="true">▼ </span>Cooling Down (14 days)</h3>
          <div className="space-y-1.5">
            {trending.data.cold.slice(0, 5).map((p) => (
              <Link key={p.player_id} to={`/players/${p.player_id}`} className="flex items-center justify-between hover:bg-muted/50 rounded px-2 py-1 -mx-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.team}</span>
                </div>
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  <span>{fmtAvg(p.recent_avg)} AVG</span>
                  <span>{p.recent_hr} HR</span>
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                    <span aria-hidden="true">▼</span> {(p.ops_delta * 1000).toFixed(0)} OPS pts
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---- Skeleton ----

function TableSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

// ---- Main ----

type TabValue = "hitting" | "pitching" | "framing" | "war" | "arsenal" | "xstats" | "batted-ball" | "platoon" | "baserunning" | "bat-tracking";

export default function Explore() {
  const [tab, setTab] = useState<TabValue>("hitting");
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [minPa, setMinPa] = useState(100);
  const [minPitches, setMinPitches] = useState(500);
  const [minBbe, setMinBbe] = useState(50);
  const [team, setTeam] = useState<string | undefined>(undefined);
  const [hittingSort, setHittingSort] = useState("ops");
  const [pitchingSort, setPitchingSort] = useState("k_pct");
  const [arsenalSort, setArsenalSort] = useState("whiff_pct");
  const [xstatsSort, setXstatsSort] = useState("woba_diff");
  const [battedBallSort, setBattedBallSort] = useState("bbe");
  const [platoonSort, setPlatoonSort] = useState("ops_diff");
  const [framingSort, setFramingSort] = useState("framing_runs");
  const [warSort, setWarSort] = useState("war");
  const [baserunningSort, setBaserunningSort] = useState("sb");
  const [pitcherBrSort, setPitcherBrSort] = useState("sb_against");
  const [batTrackingSort, setBatTrackingSort] = useState("avg_bat_speed");
  const [minSwings, setMinSwings] = useState(50);
  const [minAtt, setMinAtt] = useState(3);
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const offset = page * pageSize;

  function handleSort(currentField: string, setField: (f: string) => void, newField: string, newDesc: boolean) {
    if (newField === currentField) {
      setSortDesc(newDesc);
    } else {
      setField(newField);
      setSortDesc(true);
    }
    setPage(0);
  }

  // Reset page when tab or filters change
  function handleTabChange(v: string) {
    setTab(v as TabValue);
    setPage(0);
  }

  const seasonId = "explore-season";
  const minId = "explore-min";
  const teamId = "explore-team";

  const hitting = useHittingLeaderboard({ season, minPa, team, sort: hittingSort, desc: sortDesc, limit: pageSize, offset, enabled: tab === "hitting" });
  const pitching = usePitchingLeaderboard({ season, minPitches, team, sort: pitchingSort, desc: sortDesc, limit: pageSize, offset, enabled: tab === "pitching" });
  const framingData = useFramingLeaderboard({ season, sort: framingSort, desc: sortDesc, limit: pageSize, offset, enabled: tab === "framing" });
  const warData = useWarLeaderboard({ season, sort: warSort, desc: sortDesc, limit: pageSize, offset, enabled: tab === "war" });
  const arsenalData = useArsenalLeaderboard({ season, sort: arsenalSort, desc: sortDesc, limit: pageSize, offset, enabled: tab === "arsenal" });
  const xstatsData = useExpectedStats({ season, minPa, sort: xstatsSort, desc: sortDesc, limit: pageSize, offset, enabled: tab === "xstats" });
  const battedBallData = useBattedBallLeaderboard({ season, minBbe, sort: battedBallSort, desc: sortDesc, limit: pageSize, offset, enabled: tab === "batted-ball" });
  const platoonData = usePlatoonLeaderboard({ season, minPa, sort: platoonSort, desc: sortDesc, limit: pageSize, offset, enabled: tab === "platoon" });
  const baserunningData = useBaserunningLeaderboard({ season, minAtt, sort: baserunningSort, desc: sortDesc, limit: pageSize, offset, enabled: tab === "baserunning" });
  const pitcherBrData = usePitcherBaserunningLeaderboard({ season, minAtt, sort: pitcherBrSort, desc: sortDesc, limit: pageSize, offset, enabled: tab === "baserunning" });
  const batTrackingData = useBatTrackingLeaderboard({ season, minSwings, sort: batTrackingSort, desc: sortDesc, limit: pageSize, offset, enabled: tab === "bat-tracking" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Explore</h1>
        <div className="flex items-center gap-2">
          <label htmlFor={seasonId} className="text-sm font-medium">Season</label>
          <Select value={String(season)} onValueChange={(v) => setSeason(Number(v))}>
            <SelectTrigger id={seasonId} className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEASONS.map((s) => (<SelectItem key={s} value={String(s)}>{s}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Player search */}
      <PlayerSearch />

      {/* Trending players */}
      <TrendingSection season={season} />

      {/* Leaderboard tabs */}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="hitting">Hitting</TabsTrigger>
          <TabsTrigger value="pitching">Pitching</TabsTrigger>
          <TabsTrigger value="framing">Framing</TabsTrigger>
          <TabsTrigger value="war">WAR</TabsTrigger>
          <TabsTrigger value="arsenal">Arsenal</TabsTrigger>
          <TabsTrigger value="xstats">xStats</TabsTrigger>
          <TabsTrigger value="batted-ball">Batted Ball</TabsTrigger>
          <TabsTrigger value="platoon">Platoon</TabsTrigger>
          <TabsTrigger value="baserunning">Baserunning</TabsTrigger>
          <TabsTrigger value="bat-tracking">Bat Tracking</TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 pt-4">
          {tab === "bat-tracking" && (
            <div className="space-y-1">
              <label htmlFor="explore-min-swings" className="text-sm font-medium">Min Swings</label>
              <Input
                id="explore-min-swings"
                type="number"
                className="w-28"
                value={minSwings}
                onChange={(e) => setMinSwings(Number(e.target.value))}
              />
            </div>
          )}
          {(tab === "hitting" || tab === "pitching" || tab === "xstats" || tab === "batted-ball" || tab === "platoon") && (
            <div className="space-y-1">
              <label htmlFor={minId} className="text-sm font-medium">
                {tab === "pitching" ? "Min Pitches" : tab === "batted-ball" ? "Min BBE" : "Min PA"}
              </label>
              <Input
                id={minId}
                type="number"
                className="w-28"
                value={tab === "pitching" ? minPitches : tab === "batted-ball" ? minBbe : minPa}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (tab === "pitching") setMinPitches(val);
                  else if (tab === "batted-ball") setMinBbe(val);
                  else setMinPa(val);
                }}
              />
            </div>
          )}
          {tab === "baserunning" && (
            <div className="space-y-1">
              <label htmlFor="explore-min-att" className="text-sm font-medium">Min SB+CS</label>
              <Input
                id="explore-min-att"
                type="number"
                className="w-28"
                value={minAtt}
                onChange={(e) => setMinAtt(Number(e.target.value))}
              />
            </div>
          )}
          {(tab === "hitting" || tab === "pitching") && (
            <div className="space-y-1">
              <label htmlFor={teamId} className="text-sm font-medium">Team</label>
              <Select value={team ?? "__all__"} onValueChange={(v) => setTeam(v === "__all__" ? undefined : v)}>
                <SelectTrigger id={teamId} className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {TEAMS.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <TabsContent value="hitting" className="pt-4">
          {hitting.isLoading ? <TableSkeleton /> : hitting.isError ? (
            <QueryError message="Failed to load hitting leaderboard." onRetry={() => hitting.refetch()} />
          ) : (
            <LeaderboardTable columns={hittingColumns} data={hitting.data?.players ?? []} sortField={hittingSort} sortDesc={sortDesc} onSortChange={(f, d) => handleSort(hittingSort, setHittingSort, f, d)} total={hitting.data?.total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </TabsContent>

        <TabsContent value="pitching" className="pt-4">
          {pitching.isLoading ? <TableSkeleton /> : pitching.isError ? (
            <QueryError message="Failed to load pitching leaderboard." onRetry={() => pitching.refetch()} />
          ) : (
            <LeaderboardTable columns={pitchingColumns} data={pitching.data?.players ?? []} sortField={pitchingSort} sortDesc={sortDesc} onSortChange={(f, d) => handleSort(pitchingSort, setPitchingSort, f, d)} total={pitching.data?.total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </TabsContent>

        <TabsContent value="framing" className="pt-4">
          {framingData.isLoading ? <TableSkeleton /> : framingData.isError ? (
            <QueryError message="Failed to load framing leaderboard." onRetry={() => framingData.refetch()} />
          ) : (
            <LeaderboardTable columns={framingColumns} data={framingData.data?.players ?? []} sortField={framingSort} sortDesc={sortDesc} onSortChange={(f, d) => handleSort(framingSort, setFramingSort, f, d)} total={framingData.data?.total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </TabsContent>

        <TabsContent value="war" className="pt-4 space-y-8">
          {warData.isLoading ? <TableSkeleton /> : warData.isError ? (
            <QueryError message="Failed to load WAR leaderboard." onRetry={() => warData.refetch()} />
          ) : (
            <>
              <div>
                <h2 className="pb-2">Batting WAR</h2>
                <LeaderboardTable columns={battingWarColumns} data={warData.data?.batting ?? []} sortField={warSort} sortDesc={sortDesc} onSortChange={(f, d) => handleSort(warSort, setWarSort, f, d)} total={warData.data?.batting_total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
              </div>
              <div>
                <h2 className="pb-2">Pitching WAR</h2>
                <LeaderboardTable columns={pitchingWarColumns} data={warData.data?.pitching ?? []} sortField={warSort} sortDesc={sortDesc} onSortChange={(f, d) => handleSort(warSort, setWarSort, f, d)} total={warData.data?.pitching_total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="arsenal" className="pt-4">
          {arsenalData.isLoading ? <TableSkeleton /> : arsenalData.isError ? (
            <QueryError message="Failed to load arsenal leaderboard." onRetry={() => arsenalData.refetch()} />
          ) : (
            <LeaderboardTable columns={arsenalColumns} data={arsenalData.data?.rows ?? []} sortField={arsenalSort} sortDesc={sortDesc} onSortChange={(f, d) => handleSort(arsenalSort, setArsenalSort, f, d)} total={arsenalData.data?.total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </TabsContent>

        <TabsContent value="xstats" className="pt-4">
          {xstatsData.isLoading ? <TableSkeleton /> : xstatsData.isError ? (
            <QueryError message="Failed to load expected stats." onRetry={() => xstatsData.refetch()} />
          ) : (
            <LeaderboardTable columns={expectedStatsColumns} data={xstatsData.data?.players ?? []} sortField={xstatsSort} sortDesc={sortDesc} onSortChange={(f, d) => handleSort(xstatsSort, setXstatsSort, f, d)} total={xstatsData.data?.total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </TabsContent>

        <TabsContent value="batted-ball" className="pt-4">
          {battedBallData.isLoading ? <TableSkeleton /> : battedBallData.isError ? (
            <QueryError message="Failed to load batted ball leaderboard." onRetry={() => battedBallData.refetch()} />
          ) : (
            <LeaderboardTable columns={battedBallColumns} data={battedBallData.data?.players ?? []} sortField={battedBallSort} sortDesc={sortDesc} onSortChange={(f, d) => handleSort(battedBallSort, setBattedBallSort, f, d)} total={battedBallData.data?.total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </TabsContent>

        <TabsContent value="platoon" className="pt-4">
          {platoonData.isLoading ? <TableSkeleton /> : platoonData.isError ? (
            <QueryError message="Failed to load platoon splits." onRetry={() => platoonData.refetch()} />
          ) : (
            <LeaderboardTable columns={platoonColumns} data={platoonData.data?.players ?? []} sortField={platoonSort} sortDesc={sortDesc} onSortChange={(f, d) => handleSort(platoonSort, setPlatoonSort, f, d)} total={platoonData.data?.total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </TabsContent>

        <TabsContent value="baserunning" className="pt-4 space-y-8">
          {baserunningData.isLoading ? <TableSkeleton /> : baserunningData.isError ? (
            <QueryError message="Failed to load baserunning leaderboard." onRetry={() => baserunningData.refetch()} />
          ) : (
            <div>
              <h2 className="pb-2">Runners</h2>
              <LeaderboardTable columns={baserunningColumns} data={baserunningData.data?.players ?? []} sortField={baserunningSort} sortDesc={sortDesc} onSortChange={(f, d) => handleSort(baserunningSort, setBaserunningSort, f, d)} total={baserunningData.data?.total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          )}
          {pitcherBrData.isLoading ? <TableSkeleton /> : pitcherBrData.isError ? (
            <QueryError message="Failed to load pitcher baserunning." onRetry={() => pitcherBrData.refetch()} />
          ) : (
            <div>
              <h2 className="pb-2">Pitchers</h2>
              <LeaderboardTable columns={pitcherBaserunningColumns} data={pitcherBrData.data?.players ?? []} sortField={pitcherBrSort} sortDesc={sortDesc} onSortChange={(f, d) => handleSort(pitcherBrSort, setPitcherBrSort, f, d)} total={pitcherBrData.data?.total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="bat-tracking" className="pt-4">
          {batTrackingData.isLoading ? <TableSkeleton /> : batTrackingData.isError ? (
            <QueryError message="Failed to load bat tracking leaderboard." onRetry={() => batTrackingData.refetch()} />
          ) : (
            <LeaderboardTable columns={batTrackingColumns} data={batTrackingData.data?.players ?? []} sortField={batTrackingSort} sortDesc={sortDesc} onSortChange={(f, d) => handleSort(batTrackingSort, setBatTrackingSort, f, d)} total={batTrackingData.data?.total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
