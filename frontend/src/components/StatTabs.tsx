import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlayerStats } from "@/types/player";
import { useSprayChart, useStrikeZone, usePitchMovement } from "@/hooks/use-player";
import SprayChart from "@/components/d3/SprayChart";
import StrikeZoneHeatmap from "@/components/d3/StrikeZoneHeatmap";
import PitchMovementPlot from "@/components/d3/PitchMovementPlot";

function fmtAvg(val: number): string {
  return val.toFixed(3).replace(/^0/, "");
}

function fmtPct(val: number): string {
  return `${val.toFixed(1)}%`;
}

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
  const hitting = stats?.hitting;
  const pitching = stats?.pitching;
  const hasPitching = pitching != null;

  // Chart hooks - these are lazily enabled via their own enabled flag
  const sprayChart = useSprayChart(playerId, season);
  const strikeZone = useStrikeZone(
    playerId,
    season,
    hasPitching ? "pitcher" : "batter",
  );
  const pitchMovement = usePitchMovement(
    hasPitching ? playerId : undefined,
    season,
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
    <Tabs defaultValue="overview">
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
    </Tabs>
  );
}
