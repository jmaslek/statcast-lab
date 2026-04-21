import { useState, memo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtAvg, fmtPct } from "@/lib/format";
import type { PlayerStats, PercentileStat, CareerStatcastRow, CareerPitchingRow } from "@/types/player";
import { useSprayChart, useStrikeZone, usePitchMovement, useRollingStats, usePlayerPercentiles, useCareerHitting, useCareerPitching, usePitchUsageByCount, useGameLog, useZoneProfile } from "@/hooks/use-player";
import SprayChart from "@/components/d3/SprayChart";
import StrikeZoneHeatmap from "@/components/d3/StrikeZoneHeatmap";
import PitchMovementPlot from "@/components/d3/PitchMovementPlot";
import RollingStatLine from "@/components/d3/RollingStatLine";
import PitchUsageByCount from "@/components/PitchUsageByCount";

const ROLLING_STAT_OPTIONS = [
  { value: "avg", label: "Batting Average" },
  { value: "obp", label: "OBP" },
  { value: "slg", label: "SLG" },
  { value: "barrel_pct", label: "Barrel%" },
  { value: "hard_hit_pct", label: "Hard Hit%" },
  { value: "k_pct", label: "K%" },
  { value: "bb_pct", label: "BB%" },
  { value: "whiff_pct", label: "Whiff%" },
];

const WINDOW_OPTIONS = [
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
];

const STAT_LABELS: Record<string, string> = {
  exit_velo: "Avg Exit Velo",
  max_exit_velo: "Max Exit Velo",
  bat_speed: "Bat Speed",
  barrel_pct: "Barrel%",
  hard_hit_pct: "Hard Hit%",
  avg_launch_angle: "Avg Launch Angle",
  sweet_spot_pct: "Sweet Spot%",
  swing_length: "Swing Length",
  k_pct: "K%",
  bb_pct: "BB%",
  whiff_pct: "Whiff%",
  velocity: "Velocity",
  max_velocity: "Max Velocity",
  spin_rate: "Spin Rate",
  extension: "Extension",
  chase_pct: "Chase%",
  avg_exit_velo_against: "Exit Velo Against",
};

function percentileColor(pct: number): string {
  if (pct >= 90) return "#ef4444"; // red - elite
  if (pct >= 75) return "#f97316"; // orange - great
  if (pct >= 60) return "#eab308"; // yellow - above avg
  if (pct >= 40) return "#a3a3a3"; // grey - average
  if (pct >= 25) return "#60a5fa"; // light blue - below avg
  return "#3b82f6";                // blue - well below
}

const PercentileBars = memo(function PercentileBars({ stats }: { stats: PercentileStat[] }) {
  if (!stats.length) return null;

  return (
    <div className="space-y-2">
      {stats.map((s) => (
        <div key={s.stat_name} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-32 text-right shrink-0">
            {STAT_LABELS[s.stat_name] ?? s.stat_name}
          </span>
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${s.percentile}%`,
                  backgroundColor: percentileColor(s.percentile),
                }}
              />
            </div>
            <span
              className="text-xs font-bold w-8 text-center rounded-full px-1.5 py-0.5"
              style={{
                backgroundColor: percentileColor(s.percentile),
                color: s.percentile >= 40 && s.percentile < 60
                  ? "var(--foreground)"
                  : "#fff",
              }}
            >
              {s.percentile}
            </span>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground w-16 text-right shrink-0">
            {s.stat_value}
          </span>
        </div>
      ))}
    </div>
  );
});

function StatGrid({
  items,
}: {
  items: { label: string; value: string | number | null }[];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center rounded-lg border bg-muted/50 px-3 py-3"
        >
          <span className="text-xs text-muted-foreground font-medium">
            {item.label}
          </span>
          <span className="text-base font-bold tabular-nums">
            {item.value ?? "N/A"}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Color-code a stat cell based on how it compares to league norms */
function statCellColor(val: number | null, thresholds: [number, number, number, number]): string {
  if (val == null) return "";
  const [bad, belowAvg, aboveAvg, great] = thresholds;
  if (val >= great) return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
  if (val >= aboveAvg) return "bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300";
  if (val <= bad) return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
  if (val <= belowAvg) return "bg-sky-50 dark:bg-sky-900/20 text-sky-800 dark:text-sky-300";
  return "";
}

/** Thresholds for stat color coding: [poor, below_avg, above_avg, great] */
const HITTING_THRESHOLDS: Record<string, [number, number, number, number]> = {
  exit_velo: [85, 87, 90, 92],
  max_ev: [105, 108, 112, 115],
  barrel_pct: [3, 6, 10, 15],
  hard_hit_pct: [25, 33, 42, 50],
  xba: [0.2, 0.23, 0.27, 0.3],
  xslg: [0.3, 0.37, 0.45, 0.52],
  xwoba: [0.27, 0.3, 0.35, 0.38],
  k_pct: [25, 22, 18, 15],  // inverted - lower is better
  bb_pct: [5, 7, 10, 13],
};

const PITCHING_THRESHOLDS: Record<string, [number, number, number, number]> = {
  avg_velo: [89, 91, 94, 96],
  whiff_pct: [18, 22, 28, 33],
  csw_pct: [24, 27, 30, 33],
  k_pct: [15, 19, 25, 30],
  bb_pct: [12, 9, 7, 5],  // inverted - lower is better
  xba: [0.28, 0.25, 0.22, 0.2],  // inverted
  xwoba: [0.35, 0.32, 0.3, 0.28],  // inverted
};

function CareerHittingTable({ rows }: { rows: CareerStatcastRow[] }) {
  if (!rows.length) {
    return <p className="text-muted-foreground py-4 text-center">No career hitting data available.</p>;
  }

  const fmt = (v: number | null, d = 1) => v != null ? v.toFixed(d) : "";
  const fmtA = (v: number | null) => v != null ? v.toFixed(3).replace(/^0/, "") : "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left py-2 px-2 font-medium">Season</th>
            <th className="text-right py-2 px-2 font-medium">PA</th>
            <th className="text-right py-2 px-2 font-medium">AVG</th>
            <th className="text-right py-2 px-2 font-medium">SLG</th>
            <th className="text-right py-2 px-2 font-medium">wOBA</th>
            <th className="text-right py-2 px-2 font-medium">EV</th>
            <th className="text-right py-2 px-2 font-medium">Max EV</th>
            <th className="text-right py-2 px-2 font-medium">Barrel%</th>
            <th className="text-right py-2 px-2 font-medium">HardHit%</th>
            <th className="text-right py-2 px-2 font-medium">SwSp%</th>
            <th className="text-right py-2 px-2 font-medium">xBA</th>
            <th className="text-right py-2 px-2 font-medium">xSLG</th>
            <th className="text-right py-2 px-2 font-medium">xwOBA</th>
            <th className="text-right py-2 px-2 font-medium">K%</th>
            <th className="text-right py-2 px-2 font-medium">BB%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.season} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-1.5 px-2 font-medium">{r.season}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{r.pa}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{fmtA(r.avg)}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{fmtA(r.slg)}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{fmtA(r.woba)}</td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.exit_velo, HITTING_THRESHOLDS.exit_velo)}`}>
                {fmt(r.exit_velo)}
              </td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.max_ev, HITTING_THRESHOLDS.max_ev)}`}>
                {fmt(r.max_ev)}
              </td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.barrel_pct, HITTING_THRESHOLDS.barrel_pct)}`}>
                {fmt(r.barrel_pct)}
              </td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.hard_hit_pct, HITTING_THRESHOLDS.hard_hit_pct)}`}>
                {fmt(r.hard_hit_pct)}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">{fmt(r.sweet_spot_pct)}</td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.xba, HITTING_THRESHOLDS.xba)}`}>
                {fmtA(r.xba)}
              </td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.xslg, HITTING_THRESHOLDS.xslg)}`}>
                {fmtA(r.xslg)}
              </td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.xwoba, HITTING_THRESHOLDS.xwoba)}`}>
                {fmtA(r.xwoba)}
              </td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.k_pct, HITTING_THRESHOLDS.k_pct)}`}>
                {fmt(r.k_pct)}
              </td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.bb_pct, HITTING_THRESHOLDS.bb_pct)}`}>
                {fmt(r.bb_pct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CareerPitchingTable({ rows }: { rows: CareerPitchingRow[] }) {
  if (!rows.length) {
    return <p className="text-muted-foreground py-4 text-center">No career pitching data available.</p>;
  }

  const fmt = (v: number | null, d = 1) => v != null ? v.toFixed(d) : "";
  const fmtA = (v: number | null) => v != null ? v.toFixed(3).replace(/^0/, "") : "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left py-2 px-2 font-medium">Season</th>
            <th className="text-right py-2 px-2 font-medium">Pitches</th>
            <th className="text-right py-2 px-2 font-medium">BF</th>
            <th className="text-right py-2 px-2 font-medium">Velo</th>
            <th className="text-right py-2 px-2 font-medium">Max</th>
            <th className="text-right py-2 px-2 font-medium">Spin</th>
            <th className="text-right py-2 px-2 font-medium">Ext</th>
            <th className="text-right py-2 px-2 font-medium">K%</th>
            <th className="text-right py-2 px-2 font-medium">BB%</th>
            <th className="text-right py-2 px-2 font-medium">Whiff%</th>
            <th className="text-right py-2 px-2 font-medium">CSW%</th>
            <th className="text-right py-2 px-2 font-medium">HardHit%</th>
            <th className="text-right py-2 px-2 font-medium">Barrel%</th>
            <th className="text-right py-2 px-2 font-medium">xBA</th>
            <th className="text-right py-2 px-2 font-medium">xwOBA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.season} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-1.5 px-2 font-medium">{r.season}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{r.pitches}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{r.batters_faced}</td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.avg_velo, PITCHING_THRESHOLDS.avg_velo)}`}>
                {fmt(r.avg_velo)}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">{fmt(r.max_velo)}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{r.avg_spin ? Math.round(r.avg_spin) : ""}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{fmt(r.extension)}</td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.k_pct, PITCHING_THRESHOLDS.k_pct)}`}>
                {fmt(r.k_pct)}
              </td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.bb_pct, PITCHING_THRESHOLDS.bb_pct)}`}>
                {fmt(r.bb_pct)}
              </td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.whiff_pct, PITCHING_THRESHOLDS.whiff_pct)}`}>
                {fmt(r.whiff_pct)}
              </td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.csw_pct, PITCHING_THRESHOLDS.csw_pct)}`}>
                {fmt(r.csw_pct)}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">{fmt(r.hard_hit_pct)}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{fmt(r.barrel_pct)}</td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.xba, PITCHING_THRESHOLDS.xba)}`}>
                {fmtA(r.xba)}
              </td>
              <td className={`py-1.5 px-2 text-right tabular-nums ${statCellColor(r.xwoba, PITCHING_THRESHOLDS.xwoba)}`}>
                {fmtA(r.xwoba)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

interface StatTabsProps {
  stats: PlayerStats | undefined;
  isLoading: boolean;
  playerId: number | undefined;
  season: number;
}

export default function StatTabs({
  stats,
  isLoading,
  playerId,
  season,
}: StatTabsProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [rollingStat, setRollingStat] = useState("avg");
  const [rollingWindow, setRollingWindow] = useState(30);

  const hitting = stats?.hitting;
  const pitching = stats?.pitching;
  const hasPitching = pitching != null;

  // Chart hooks - only fetch when tab is active (or has been visited)
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(["overview"]));
  const tabVisited = (tab: string) => visitedTabs.has(tab);

  const sprayChart = useSprayChart(tabVisited("spray") ? playerId : undefined, season);
  const strikeZone = useStrikeZone(
    tabVisited("zone") ? playerId : undefined,
    season,
    hasPitching ? "pitcher" : "batter",
  );
  const pitchMovement = usePitchMovement(
    tabVisited("movement") && hasPitching ? playerId : undefined,
    season,
  );
  const rollingStats = useRollingStats(
    tabVisited("trends") ? playerId : undefined,
    season, rollingStat, rollingWindow,
  );
  const percentiles = usePlayerPercentiles(
    tabVisited("percentiles") ? playerId : undefined,
    season,
  );
  const gameLog = useGameLog(
    tabVisited("game-log") ? playerId : undefined,
    season,
  );
  const zoneProfile = useZoneProfile(
    tabVisited("zone-profile") ? playerId : undefined,
    season,
    hasPitching ? "pitcher" : "batter",
  );
  const pitchUsage = usePitchUsageByCount(
    tabVisited("pitch-usage") && hasPitching ? playerId : undefined,
    season,
  );
  const careerHitting = useCareerHitting(
    tabVisited("career") ? playerId : undefined,
  );
  const careerPitching = useCareerPitching(
    tabVisited("career") && hasPitching ? playerId : undefined,
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">
            No stats available for this player and season.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={(v) => {
      setActiveTab(v);
      setVisitedTabs((prev) => new Set(prev).add(v));
    }}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        {hitting && (
          <TabsTrigger value="hitting-detail">Hitting Detail</TabsTrigger>
        )}
        {hasPitching && (
          <TabsTrigger value="pitching-detail">Pitching Detail</TabsTrigger>
        )}
        <TabsTrigger value="spray">Spray Chart</TabsTrigger>
        <TabsTrigger value="zone">Zone</TabsTrigger>
        {hasPitching && (
          <TabsTrigger value="movement">Movement</TabsTrigger>
        )}
        {hasPitching && (
          <TabsTrigger value="pitch-usage">By Count</TabsTrigger>
        )}
        <TabsTrigger value="trends">Trends</TabsTrigger>
        <TabsTrigger value="game-log">Game Log</TabsTrigger>
        <TabsTrigger value="zone-profile">Whiff Map</TabsTrigger>
        <TabsTrigger value="percentiles">Percentiles</TabsTrigger>
        <TabsTrigger value="career">Career</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="pt-4 space-y-6">
        {hitting && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hitting Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <StatGrid
                items={[
                  { label: "PA", value: hitting.pa },
                  { label: "AB", value: hitting.ab },
                  { label: "H", value: hitting.hits },
                  { label: "HR", value: hitting.home_runs },
                  { label: "BB", value: hitting.walks },
                  { label: "K", value: hitting.strikeouts },
                  { label: "AVG", value: fmtAvg(hitting.avg) },
                  { label: "OBP", value: fmtAvg(hitting.obp) },
                  { label: "SLG", value: fmtAvg(hitting.slg) },
                  {
                    label: "OPS",
                    value: fmtAvg(hitting.obp + hitting.slg),
                  },
                  {
                    label: "Exit Velo",
                    value: hitting.avg_exit_velo?.toFixed(1) ?? null,
                  },
                  { label: "Barrel%", value: fmtPct(hitting.barrel_pct) },
                ]}
              />
            </CardContent>
          </Card>
        )}
        {hasPitching && pitching && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pitching Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <StatGrid
                items={[
                  { label: "Pitches", value: pitching.total_pitches },
                  { label: "BF", value: pitching.batters_faced },
                  { label: "K", value: pitching.strikeouts },
                  { label: "BB", value: pitching.walks },
                  { label: "K%", value: fmtPct(pitching.k_pct) },
                  { label: "BB%", value: fmtPct(pitching.bb_pct) },
                  { label: "Whiff%", value: fmtPct(pitching.whiff_pct) },
                  { label: "CSW%", value: fmtPct(pitching.csw_pct) },
                  {
                    label: "Velo",
                    value: pitching.avg_velo?.toFixed(1) ?? null,
                  },
                  {
                    label: "Spin",
                    value:
                      pitching.avg_spin != null
                        ? Math.round(pitching.avg_spin)
                        : null,
                  },
                  {
                    label: "Extension",
                    value: pitching.avg_extension?.toFixed(1) ?? null,
                  },
                ]}
              />
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Hitting Detail Tab */}
      {hitting && (
        <TabsContent value="hitting-detail" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Full Hitting Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Stat</th>
                      <th className="text-right py-2 px-3 font-medium">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["PA", hitting.pa],
                      ["AB", hitting.ab],
                      ["Hits", hitting.hits],
                      ["Singles", hitting.singles],
                      ["Doubles", hitting.doubles],
                      ["Triples", hitting.triples],
                      ["Home Runs", hitting.home_runs],
                      ["Walks", hitting.walks],
                      ["Strikeouts", hitting.strikeouts],
                      ["HBP", hitting.hbp],
                      ["Sac Flies", hitting.sac_flies],
                      ["Total Bases", hitting.total_bases],
                      ["AVG", fmtAvg(hitting.avg)],
                      ["OBP", fmtAvg(hitting.obp)],
                      ["SLG", fmtAvg(hitting.slg)],
                      ["OPS", fmtAvg(hitting.obp + hitting.slg)],
                      [
                        "Avg Exit Velo",
                        hitting.avg_exit_velo?.toFixed(1) ?? "N/A",
                      ],
                      [
                        "Avg Launch Angle",
                        hitting.avg_launch_angle?.toFixed(1) ?? "N/A",
                      ],
                      ["Barrel%", fmtPct(hitting.barrel_pct)],
                      ["Hard Hit%", fmtPct(hitting.hard_hit_pct)],
                    ].map(([label, value]) => (
                      <tr key={label as string} className="border-b last:border-0">
                        <td className="py-2 px-3 text-muted-foreground">
                          {label}
                        </td>
                        <td className="py-2 px-3 text-right font-medium tabular-nums">
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {/* Pitching Detail Tab */}
      {hasPitching && pitching && (
        <TabsContent value="pitching-detail" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Full Pitching Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Stat</th>
                      <th className="text-right py-2 px-3 font-medium">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Total Pitches", pitching.total_pitches],
                      ["Batters Faced", pitching.batters_faced],
                      ["Strikeouts", pitching.strikeouts],
                      ["Walks", pitching.walks],
                      ["Hits Allowed", pitching.hits_allowed],
                      ["HR Allowed", pitching.home_runs_allowed],
                      ["K%", fmtPct(pitching.k_pct)],
                      ["BB%", fmtPct(pitching.bb_pct)],
                      ["Whiff%", fmtPct(pitching.whiff_pct)],
                      ["CSW%", fmtPct(pitching.csw_pct)],
                      [
                        "Avg Velo",
                        pitching.avg_velo?.toFixed(1) ?? "N/A",
                      ],
                      [
                        "Avg Spin",
                        pitching.avg_spin != null
                          ? Math.round(pitching.avg_spin).toString()
                          : "N/A",
                      ],
                      [
                        "Avg Extension",
                        pitching.avg_extension?.toFixed(1) ?? "N/A",
                      ],
                    ].map(([label, value]) => (
                      <tr key={label as string} className="border-b last:border-0">
                        <td className="py-2 px-3 text-muted-foreground">
                          {label}
                        </td>
                        <td className="py-2 px-3 text-right font-medium tabular-nums">
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {/* Spray Chart Tab */}
      <TabsContent value="spray" className="pt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spray Chart</CardTitle>
          </CardHeader>
          <CardContent>
            {sprayChart.isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : sprayChart.data?.points.length ? (
              <div className="flex justify-center">
                <SprayChart data={sprayChart.data.points} />
              </div>
            ) : (
              <div className="h-[400px] w-full flex items-center justify-center border rounded-lg bg-muted/30">
                <p className="text-muted-foreground">
                  No spray chart data available
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Zone Tab */}
      <TabsContent value="zone" className="pt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Strike Zone</CardTitle>
          </CardHeader>
          <CardContent>
            {strikeZone.isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : strikeZone.data?.points.length ? (
              <div className="flex justify-center">
                <StrikeZoneHeatmap data={strikeZone.data.points} />
              </div>
            ) : (
              <div className="h-[400px] w-full flex items-center justify-center border rounded-lg bg-muted/30">
                <p className="text-muted-foreground">
                  No strike zone data available
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Movement Tab (pitchers only) */}
      {hasPitching && (
        <TabsContent value="movement" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pitch Movement</CardTitle>
            </CardHeader>
            <CardContent>
              {pitchMovement.isLoading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : pitchMovement.data?.points.length ? (
                <div className="flex justify-center">
                  <PitchMovementPlot
                    data={pitchMovement.data.points}
                    leagueAverages={pitchMovement.data.league_averages}
                    pitchSummary={pitchMovement.data.pitch_summary}
                    pThrows={pitchMovement.data.p_throws}
                  />
                </div>
              ) : (
                <div className="h-[400px] w-full flex items-center justify-center border rounded-lg bg-muted/30">
                  <p className="text-muted-foreground">
                    No pitch movement data available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {/* Pitch Usage By Count Tab (pitchers only) */}
      {hasPitching && (
        <TabsContent value="pitch-usage" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pitch Usage by Count</CardTitle>
            </CardHeader>
            <CardContent>
              {pitchUsage.isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : pitchUsage.data?.cells.length ? (
                <PitchUsageByCount data={pitchUsage.data} />
              ) : (
                <div className="h-[300px] w-full flex items-center justify-center border rounded-lg bg-muted/30">
                  <p className="text-muted-foreground">
                    No pitch usage data available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {/* Trends Tab */}
      <TabsContent value="trends" className="pt-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-lg">Rolling Stats</CardTitle>
              <div className="flex items-center gap-3">
                <Select value={rollingStat} onValueChange={setRollingStat}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLLING_STAT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(rollingWindow)}
                  onValueChange={(v) => setRollingWindow(Number(v))}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WINDOW_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rollingStats.isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : rollingStats.isError ? (
              <div className="text-destructive">
                Failed to load rolling stats.
              </div>
            ) : rollingStats.data?.data.length ? (
              <div className="flex justify-center">
                <RollingStatLine
                  data={rollingStats.data.data}
                  statName={
                    ROLLING_STAT_OPTIONS.find((o) => o.value === rollingStat)
                      ?.label ?? rollingStat
                  }
                  leagueAvg={rollingStats.data.league_avg ?? undefined}
                />
              </div>
            ) : (
              <div className="h-[300px] w-full flex items-center justify-center border rounded-lg bg-muted/30">
                <p className="text-muted-foreground">
                  Not enough data for rolling stats yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Game Log Tab */}
      <TabsContent value="game-log" className="pt-4 space-y-6">
        {hitting && gameLog.data?.hitting.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hitting Game Log</CardTitle>
            </CardHeader>
            <CardContent>
              {gameLog.isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-2 px-2 font-medium">Date</th>
                        <th className="text-left py-2 px-2 font-medium">Opp</th>
                        <th className="text-right py-2 px-2 font-medium">PA</th>
                        <th className="text-right py-2 px-2 font-medium">AB</th>
                        <th className="text-right py-2 px-2 font-medium">H</th>
                        <th className="text-right py-2 px-2 font-medium">2B</th>
                        <th className="text-right py-2 px-2 font-medium">3B</th>
                        <th className="text-right py-2 px-2 font-medium">HR</th>
                        <th className="text-right py-2 px-2 font-medium">BB</th>
                        <th className="text-right py-2 px-2 font-medium">K</th>
                        <th className="text-right py-2 px-2 font-medium">AVG</th>
                        <th className="text-right py-2 px-2 font-medium">OBP</th>
                        <th className="text-right py-2 px-2 font-medium">SLG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gameLog.data.hitting.map((r, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-1.5 px-2 tabular-nums">{r.game_date}</td>
                          <td className="py-1.5 px-2 font-medium">{r.opponent}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{r.pa}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{r.ab}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums font-medium">{r.hits}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{r.doubles}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{r.triples}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums font-medium">{r.home_runs || ""}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{r.walks}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{r.strikeouts}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{fmtAvg(r.avg)}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{fmtAvg(r.obp)}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{fmtAvg(r.slg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
        {hasPitching && gameLog.data?.pitching.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pitching Game Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2 px-2 font-medium">Date</th>
                      <th className="text-left py-2 px-2 font-medium">Opp</th>
                      <th className="text-right py-2 px-2 font-medium">IP</th>
                      <th className="text-right py-2 px-2 font-medium">H</th>
                      <th className="text-right py-2 px-2 font-medium">BB</th>
                      <th className="text-right py-2 px-2 font-medium">K</th>
                      <th className="text-right py-2 px-2 font-medium">Pitches</th>
                      <th className="text-right py-2 px-2 font-medium">Whiff%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameLog.data.pitching.map((r, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-1.5 px-2 tabular-nums">{r.game_date}</td>
                        <td className="py-1.5 px-2 font-medium">{r.opponent}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{r.ip}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{r.hits_allowed}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{r.walks}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-medium">{r.strikeouts}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{r.pitches}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{r.whiff_pct != null ? fmtPct(r.whiff_pct) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : null}
        {gameLog.isLoading ? (
          <Card><CardContent className="pt-6"><Skeleton className="h-[200px] w-full" /></CardContent></Card>
        ) : !gameLog.data?.hitting.length && !gameLog.data?.pitching.length ? (
          <Card><CardContent className="pt-6"><p className="text-muted-foreground text-center py-4">No game log data available.</p></CardContent></Card>
        ) : null}
      </TabsContent>

      {/* Zone Profile / Whiff Map Tab */}
      <TabsContent value="zone-profile" className="pt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Zone Swing & Whiff Profile</CardTitle>
          </CardHeader>
          <CardContent>
            {zoneProfile.isLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : zoneProfile.data?.bins.length ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(["whiff_pct", "swing_pct", "called_strike_pct"] as const).map((metric) => {
                    const label = metric === "whiff_pct" ? "Whiff %" : metric === "swing_pct" ? "Swing %" : "Called Strike %";
                    const colorScale = metric === "whiff_pct" ? "#ef4444" : metric === "swing_pct" ? "#3b82f6" : "#22c55e";
                    const bins = zoneProfile.data!.bins;
                    const maxVal = Math.max(...bins.map((b) => b[metric] ?? 0), 1);
                    return (
                      <div key={metric}>
                        <h4 className="text-sm font-medium text-center mb-2">{label}</h4>
                        <div className="grid grid-cols-7 gap-0.5 mx-auto" style={{ maxWidth: 220 }}>
                          {bins.map((bin, i) => {
                            const val = bin[metric];
                            const opacity = val != null ? Math.max(0.08, val / maxVal) : 0;
                            return (
                              <div
                                key={i}
                                className="aspect-square flex items-center justify-center text-[9px] tabular-nums font-medium rounded-sm"
                                style={{
                                  backgroundColor: `color-mix(in srgb, ${colorScale} ${Math.round(opacity * 100)}%, transparent)`,
                                }}
                                title={`(${bin.x.toFixed(1)}, ${bin.y.toFixed(1)}): ${val != null ? val.toFixed(1) + "%" : "N/A"} (${bin.total} pitches)`}
                              >
                                {val != null && bin.total >= 5 ? Math.round(val) : ""}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  7x7 grid from catcher's perspective. Higher intensity = higher rate. Hover for details.
                </p>
              </div>
            ) : (
              <div className="h-[300px] w-full flex items-center justify-center border rounded-lg bg-muted/30">
                <p className="text-muted-foreground">No zone profile data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Percentiles Tab */}
      <TabsContent value="percentiles" className="pt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Percentile Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            {percentiles.isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : percentiles.isError ? (
              <div className="text-destructive">Failed to load percentiles.</div>
            ) : (
              <div className="space-y-6">
                {percentiles.data?.batting.length ? (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">Batting</h3>
                    <PercentileBars stats={percentiles.data.batting} />
                  </div>
                ) : null}
                {percentiles.data?.pitching.length ? (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">Pitching</h3>
                    <PercentileBars stats={percentiles.data.pitching} />
                  </div>
                ) : null}
                {!percentiles.data?.batting.length && !percentiles.data?.pitching.length && (
                  <div className="h-[200px] w-full flex items-center justify-center border rounded-lg bg-muted/30">
                    <p className="text-muted-foreground">
                      Not enough data for percentile rankings yet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Career Tab */}
      <TabsContent value="career" className="pt-4 space-y-6">
        {hitting && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Career Statcast Hitting</CardTitle>
            </CardHeader>
            <CardContent>
              {careerHitting.isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : careerHitting.data?.rows.length ? (
                <CareerHittingTable rows={careerHitting.data.rows} />
              ) : (
                <p className="text-muted-foreground py-4 text-center">No career data available.</p>
              )}
            </CardContent>
          </Card>
        )}
        {hasPitching && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Career Statcast Pitching</CardTitle>
            </CardHeader>
            <CardContent>
              {careerPitching.isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : careerPitching.data?.rows.length ? (
                <CareerPitchingTable rows={careerPitching.data.rows} />
              ) : (
                <p className="text-muted-foreground py-4 text-center">No career pitching data available.</p>
              )}
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
