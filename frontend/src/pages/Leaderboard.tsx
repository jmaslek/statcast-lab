import { useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
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
import { LeaderboardTable } from "@/components/LeaderboardTable";
import {
  useHittingLeaderboard,
  usePitchingLeaderboard,
  useFramingLeaderboard,
  useWarLeaderboard,
  useArsenalLeaderboard,
  useExpectedStats,
  useBattedBallLeaderboard,
  usePlatoonLeaderboard,
} from "@/hooks/use-leaderboard";
import type { HittingLeaderRow, PitchingLeaderRow, FramingLeaderRow, BattingWarRow, PitchingWarRow, ArsenalRow, ExpectedStatsRow, BattedBallRow, PlatoonRow } from "@/types/stats";

// ---- Formatting helpers ----

function fmtAvg(val: number): string {
  return val.toFixed(3).replace(/^0/, "");
}

function fmtPct(val: number): string {
  return `${val.toFixed(1)}%`;
}

function fmtDec1(val: number): string {
  return val.toFixed(1);
}

function fmtNullableAvg(val: number | null): string {
  return val != null ? fmtAvg(val) : "—";
}

function fmtDiff(val: number): string {
  const prefix = val > 0 ? "+" : "";
  return `${prefix}${val.toFixed(3).replace(/^(-?)0/, "$1")}`;
}

function diffColor(val: number | null): string {
  if (val == null) return "";
  if (val > 0.02) return "text-green-600 font-semibold";
  if (val > 0) return "text-green-500";
  if (val < -0.02) return "text-red-600 font-semibold";
  if (val < 0) return "text-red-500";
  return "";
}

// ---- Column definitions ----

const hittingColumns: ColumnDef<HittingLeaderRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Name",
    enableSorting: false,
    cell: ({ row }) => nameCell(row),
  },
  { accessorKey: "pa", header: "PA" },
  {
    accessorKey: "avg",
    header: "AVG",
    cell: ({ getValue }) => fmtAvg(getValue() as number),
  },
  {
    accessorKey: "obp",
    header: "OBP",
    cell: ({ getValue }) => fmtAvg(getValue() as number),
  },
  {
    accessorKey: "slg",
    header: "SLG",
    cell: ({ getValue }) => fmtAvg(getValue() as number),
  },
  {
    accessorKey: "ops",
    header: "OPS",
    cell: ({ getValue }) => fmtAvg(getValue() as number),
  },
  {
    accessorKey: "xba",
    header: "xBA",
    cell: ({ getValue }) => fmtNullableAvg(getValue() as number | null),
  },
  {
    accessorKey: "xwoba",
    header: "xwOBA",
    cell: ({ getValue }) => fmtNullableAvg(getValue() as number | null),
  },
  { accessorKey: "home_runs", header: "HR" },
  { accessorKey: "walks", header: "BB" },
  { accessorKey: "strikeouts", header: "K" },
  {
    accessorKey: "barrel_pct",
    header: "Barrel%",
    cell: ({ getValue }) => fmtPct(getValue() as number),
  },
  {
    accessorKey: "avg_exit_velo",
    header: "EV",
    cell: ({ getValue }) => fmtDec1(getValue() as number),
  },
  {
    accessorKey: "hard_hit_pct",
    header: "HardHit%",
    cell: ({ getValue }) => fmtPct(getValue() as number),
  },
];

const pitchingColumns: ColumnDef<PitchingLeaderRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Name",
    enableSorting: false,
    cell: ({ row }) => nameCell(row),
  },
  { accessorKey: "total_pitches", header: "Pitches" },
  { accessorKey: "batters_faced", header: "BF" },
  {
    accessorKey: "k_pct",
    header: "K%",
    cell: ({ getValue }) => fmtPct(getValue() as number),
  },
  {
    accessorKey: "bb_pct",
    header: "BB%",
    cell: ({ getValue }) => fmtPct(getValue() as number),
  },
  {
    accessorKey: "whiff_pct",
    header: "Whiff%",
    cell: ({ getValue }) => fmtPct(getValue() as number),
  },
  {
    accessorKey: "csw_pct",
    header: "CSW%",
    cell: ({ getValue }) => fmtPct(getValue() as number),
  },
  {
    accessorKey: "avg_velo",
    header: "Velo",
    cell: ({ getValue }) => fmtDec1(getValue() as number),
  },
  {
    accessorKey: "avg_spin",
    header: "Spin",
    cell: ({ getValue }) => Math.round(getValue() as number),
  },
];

const framingColumns: ColumnDef<FramingLeaderRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Name",
    enableSorting: false,
    cell: ({ row }) => nameCell(row),
  },
  { accessorKey: "total_called", header: "Called Pitches" },
  { accessorKey: "called_strikes", header: "Called Strikes" },
  {
    accessorKey: "strike_rate",
    header: "Strike Rate%",
    cell: ({ getValue }) => fmtPct(getValue() as number),
  },
  {
    accessorKey: "strikes_above_avg",
    header: "Strikes Above Avg",
    cell: ({ getValue }) => fmtDec1(getValue() as number),
  },
  {
    accessorKey: "framing_runs",
    header: "Framing Runs",
    cell: ({ getValue }) => fmtDec1(getValue() as number),
  },
];

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
  {
    accessorKey: "avg_exit_velo", header: "EV",
    cell: ({ getValue }) => { const v = getValue() as number | null; return v != null ? fmtDec1(v) : "—"; },
  },
  { accessorKey: "gb_pct", header: "GB%", cell: ({ getValue }) => fmtPct(getValue() as number) },
];

function xstatsNameCell(row: { original: ExpectedStatsRow }) {
  return (
    <Link
      to={`/players/${row.original.player_id}`}
      className="text-primary underline-offset-4 hover:underline font-medium"
    >
      {row.original.name}
    </Link>
  );
}

const expectedStatsColumns: ColumnDef<ExpectedStatsRow, unknown>[] = [
  { accessorKey: "name", header: "Name", enableSorting: false, cell: ({ row }) => xstatsNameCell(row) },
  { accessorKey: "pa", header: "PA" },
  { accessorKey: "ba", header: "BA", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  { accessorKey: "xba", header: "xBA", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  {
    accessorKey: "ba_diff", header: "BA-xBA",
    cell: ({ getValue }) => { const v = getValue() as number; return <span className={diffColor(v)}>{fmtDiff(v)}</span>; },
  },
  { accessorKey: "woba", header: "wOBA", cell: ({ getValue }) => fmtNullableAvg(getValue() as number | null) },
  { accessorKey: "xwoba", header: "xwOBA", cell: ({ getValue }) => fmtAvg(getValue() as number) },
  {
    accessorKey: "woba_diff", header: "wOBA-xwOBA",
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      if (v == null) return "—";
      return <span className={diffColor(v)}>{fmtDiff(v)}</span>;
    },
  },
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
  {
    accessorKey: "ops_diff", header: "OPS Diff",
    cell: ({ getValue }) => { const v = getValue() as number; return <span className={diffColor(v)}>{fmtDiff(v)}</span>; },
  },
];

// ---- Seasons array ----
const SEASONS = Array.from({ length: 11 }, (_, i) => 2025 - i); // 2025..2015 (newest first)

// ---- MLB teams for filter ----
const TEAMS = [
  "ATH", "ATL", "AZ", "BAL", "BOS", "CHC", "CIN", "CLE", "COL", "CWS",
  "DET", "HOU", "KC", "LAA", "LAD", "MIA", "MIL", "MIN", "NYM", "NYY",
  "PHI", "PIT", "SD", "SEA", "SF", "STL", "TB", "TEX", "TOR", "WSH",
];

// ---- Skeleton loader ----

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

// ---- Main page component ----

export default function Leaderboard() {
  const [tab, setTab] = useState<"hitting" | "pitching" | "framing" | "war" | "arsenal" | "xstats" | "batted-ball" | "platoon">("hitting");
  const [season, setSeason] = useState(2025);
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
  const limit = 50;

  const hitting = useHittingLeaderboard({
    season,
    minPa,
    team,
    sort: hittingSort,
    limit,
  });

  const pitching = usePitchingLeaderboard({
    season,
    minPitches,
    team,
    sort: pitchingSort,
    limit,
  });

  const framingData = useFramingLeaderboard({
    season,
    limit,
  });

  const warData = useWarLeaderboard({
    season,
    limit,
  });

  const arsenalData = useArsenalLeaderboard({
    season,
    sort: arsenalSort,
    limit: 100,
  });

  const xstatsData = useExpectedStats({
    season,
    minPa,
    sort: xstatsSort,
    limit,
  });

  const battedBallData = useBattedBallLeaderboard({
    season,
    minBbe,
    sort: battedBallSort,
    limit,
  });

  const platoonData = usePlatoonLeaderboard({
    season,
    minPa,
    sort: platoonSort,
    limit,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leaderboards</h1>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
      >
        <TabsList>
          <TabsTrigger value="hitting">Hitting</TabsTrigger>
          <TabsTrigger value="pitching">Pitching</TabsTrigger>
          <TabsTrigger value="framing">Framing</TabsTrigger>
          <TabsTrigger value="war">WAR</TabsTrigger>
          <TabsTrigger value="arsenal">Arsenal</TabsTrigger>
          <TabsTrigger value="xstats">xStats</TabsTrigger>
          <TabsTrigger value="batted-ball">Batted Ball</TabsTrigger>
          <TabsTrigger value="platoon">Platoon</TabsTrigger>
        </TabsList>

        {/* Filters row */}
        <div className="flex flex-wrap items-end gap-4 pt-4">
          {/* Season */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Season</label>
            <Select
              value={String(season)}
              onValueChange={(v) => setSeason(Number(v))}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEASONS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(tab === "hitting" || tab === "pitching" || tab === "xstats" || tab === "batted-ball" || tab === "platoon") && (
            <div className="space-y-1">
              <label className="text-sm font-medium">
                {tab === "pitching" ? "Min Pitches" : tab === "batted-ball" ? "Min BBE" : "Min PA"}
              </label>
              <Input
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

          {(tab === "hitting" || tab === "pitching") && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Team</label>
              <Select
                value={team ?? "__all__"}
                onValueChange={(v) => setTeam(v === "__all__" ? undefined : v)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {TEAMS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Hitting tab */}
        <TabsContent value="hitting" className="pt-4">
          {hitting.isLoading ? (
            <TableSkeleton />
          ) : hitting.isError ? (
            <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
              Failed to load hitting leaderboard.{" "}
              {hitting.error instanceof Error ? hitting.error.message : ""}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground pb-2">
                {hitting.data?.total ?? 0} players found
              </p>
              <LeaderboardTable
                columns={hittingColumns}
                data={hitting.data?.players ?? []}
                sortField={hittingSort}
                onSortChange={setHittingSort}
              />
            </>
          )}
        </TabsContent>

        {/* Pitching tab */}
        <TabsContent value="pitching" className="pt-4">
          {pitching.isLoading ? (
            <TableSkeleton />
          ) : pitching.isError ? (
            <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
              Failed to load pitching leaderboard.{" "}
              {pitching.error instanceof Error ? pitching.error.message : ""}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground pb-2">
                {pitching.data?.total ?? 0} players found
              </p>
              <LeaderboardTable
                columns={pitchingColumns}
                data={pitching.data?.players ?? []}
                sortField={pitchingSort}
                onSortChange={setPitchingSort}
              />
            </>
          )}
        </TabsContent>

        {/* Framing tab */}
        <TabsContent value="framing" className="pt-4">
          {framingData.isLoading ? (
            <TableSkeleton />
          ) : framingData.isError ? (
            <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
              Failed to load framing leaderboard.{" "}
              {framingData.error instanceof Error ? framingData.error.message : ""}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground pb-2">
                {framingData.data?.total ?? 0} catchers found
              </p>
              <LeaderboardTable
                columns={framingColumns}
                data={framingData.data?.players ?? []}
                sortField="framing_runs"
                onSortChange={() => {}}
              />
            </>
          )}
        </TabsContent>

        {/* WAR tab */}
        <TabsContent value="war" className="pt-4 space-y-8">
          {warData.isLoading ? (
            <TableSkeleton />
          ) : warData.isError ? (
            <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
              Failed to load WAR leaderboard.{" "}
              {warData.error instanceof Error ? warData.error.message : ""}
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold pb-2">Batting WAR</h2>
                <LeaderboardTable
                  columns={battingWarColumns}
                  data={warData.data?.batting ?? []}
                  sortField="war"
                  onSortChange={() => {}}
                />
              </div>
              <div>
                <h2 className="text-lg font-semibold pb-2">Pitching WAR</h2>
                <LeaderboardTable
                  columns={pitchingWarColumns}
                  data={warData.data?.pitching ?? []}
                  sortField="ra9_war"
                  onSortChange={() => {}}
                />
              </div>
            </>
          )}
        </TabsContent>

        {/* Arsenal tab */}
        <TabsContent value="arsenal" className="pt-4">
          {arsenalData.isLoading ? (
            <TableSkeleton />
          ) : arsenalData.isError ? (
            <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
              Failed to load arsenal leaderboard.{" "}
              {arsenalData.error instanceof Error ? arsenalData.error.message : ""}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground pb-2">
                {arsenalData.data?.total ?? 0} pitcher-pitch rows found
              </p>
              <LeaderboardTable
                columns={arsenalColumns}
                data={arsenalData.data?.rows ?? []}
                sortField={arsenalSort}
                onSortChange={setArsenalSort}
              />
            </>
          )}
        </TabsContent>

        {/* xStats tab */}
        <TabsContent value="xstats" className="pt-4">
          {xstatsData.isLoading ? (
            <TableSkeleton />
          ) : xstatsData.isError ? (
            <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
              Failed to load expected stats.{" "}
              {xstatsData.error instanceof Error ? xstatsData.error.message : ""}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground pb-2">
                {xstatsData.data?.total ?? 0} players found
              </p>
              <LeaderboardTable
                columns={expectedStatsColumns}
                data={xstatsData.data?.players ?? []}
                sortField={xstatsSort}
                onSortChange={setXstatsSort}
              />
            </>
          )}
        </TabsContent>

        {/* Batted Ball tab */}
        <TabsContent value="batted-ball" className="pt-4">
          {battedBallData.isLoading ? (
            <TableSkeleton />
          ) : battedBallData.isError ? (
            <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
              Failed to load batted ball leaderboard.{" "}
              {battedBallData.error instanceof Error ? battedBallData.error.message : ""}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground pb-2">
                {battedBallData.data?.total ?? 0} players found
              </p>
              <LeaderboardTable
                columns={battedBallColumns}
                data={battedBallData.data?.players ?? []}
                sortField={battedBallSort}
                onSortChange={setBattedBallSort}
              />
            </>
          )}
        </TabsContent>

        {/* Platoon tab */}
        <TabsContent value="platoon" className="pt-4">
          {platoonData.isLoading ? (
            <TableSkeleton />
          ) : platoonData.isError ? (
            <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
              Failed to load platoon splits.{" "}
              {platoonData.error instanceof Error ? platoonData.error.message : ""}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground pb-2">
                {platoonData.data?.total ?? 0} players found
              </p>
              <LeaderboardTable
                columns={platoonColumns}
                data={platoonData.data?.players ?? []}
                sortField={platoonSort}
                onSortChange={setPlatoonSort}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
