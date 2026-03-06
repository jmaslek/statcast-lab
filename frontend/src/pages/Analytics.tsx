import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useREMatrix, useLinearWeights, useParkFactors } from "@/hooks/use-analytics";
import type { REMatrixEntry, LinearWeightsRow, ParkFactorRow } from "@/types/analytics";

const RUNNER_LABELS: Record<string, string> = {
  "---": "Bases Empty",
  "1--": "1B",
  "-2-": "2B",
  "12-": "1B 2B",
  "--3": "3B",
  "1-3": "1B 3B",
  "-23": "2B 3B",
  "123": "Loaded",
};

// Base states in display order (matches base_out_state 0-7)
const BASE_STATE_ORDER = ["---", "1--", "-2-", "12-", "--3", "1-3", "-23", "123"];

function reColor(value: number, min: number, max: number): string {
  const t = max === min ? 0.5 : (value - min) / (max - min);
  // Interpolate from red (low) through yellow to green (high)
  const r = Math.round(220 - t * 180);
  const g = Math.round(60 + t * 160);
  const b = Math.round(60);
  return `rgb(${r}, ${g}, ${b})`;
}

function REMatrixGrid({ entries }: { entries: REMatrixEntry[] }) {
  const values = entries.map((e) => e.expected_runs);
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Build lookup: runners_on + outs -> entry
  const lookup = new Map<string, REMatrixEntry>();
  entries.forEach((e) => {
    lookup.set(`${e.runners_on}_${e.outs}`, e);
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="py-2 px-3 text-left font-medium border-b">
              Runners
            </th>
            <th className="py-2 px-3 text-center font-medium border-b">
              0 Outs
            </th>
            <th className="py-2 px-3 text-center font-medium border-b">
              1 Out
            </th>
            <th className="py-2 px-3 text-center font-medium border-b">
              2 Outs
            </th>
          </tr>
        </thead>
        <tbody>
          {BASE_STATE_ORDER.map((runners) => (
            <tr key={runners} className="border-b last:border-0">
              <td className="py-2 px-3 font-medium text-muted-foreground">
                {RUNNER_LABELS[runners] ?? runners}
              </td>
              {[0, 1, 2].map((outs) => {
                const entry = lookup.get(`${runners}_${outs}`);
                const val = entry?.expected_runs ?? 0;
                return (
                  <td
                    key={outs}
                    className="py-2 px-3 text-center tabular-nums font-medium"
                    style={{
                      backgroundColor: reColor(val, min, max),
                      color: "#fff",
                    }}
                    title={`${entry?.occurrences ?? 0} occurrences`}
                  >
                    {val.toFixed(3)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const WEIGHT_KEYS = [
  "wBB",
  "wHBP",
  "w1B",
  "w2B",
  "w3B",
  "wHR",
  "lg_woba",
  "woba_scale",
] as const;

const WEIGHT_LABELS: Record<string, string> = {
  wBB: "wBB",
  wHBP: "wHBP",
  w1B: "w1B",
  w2B: "w2B",
  w3B: "w3B",
  wHR: "wHR",
  lg_woba: "lgwOBA",
  woba_scale: "wOBA Scale",
};

function LinearWeightsTable({ weights }: { weights: LinearWeightsRow[] }) {
  const custom = weights.find((w) => w.source === "custom");
  const fangraphs = weights.find((w) => w.source === "fangraphs");

  if (!custom && !fangraphs) {
    return (
      <p className="text-muted-foreground">No linear weights data available</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 px-3 text-left font-medium">Weight</th>
            {custom && (
              <th className="py-2 px-3 text-right font-medium">Custom</th>
            )}
            {fangraphs && (
              <th className="py-2 px-3 text-right font-medium">FanGraphs</th>
            )}
            {custom && fangraphs && (
              <>
                <th className="py-2 px-3 text-right font-medium">Diff</th>
                <th className="py-2 px-3 text-right font-medium">% Diff</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {WEIGHT_KEYS.map((key) => {
            const cVal = custom?.[key] ?? null;
            const fVal = fangraphs?.[key] ?? null;
            const diff =
              cVal != null && fVal != null ? cVal - fVal : null;
            const pctDiff =
              diff != null && fVal !== 0
                ? (diff / Math.abs(fVal)) * 100
                : null;

            return (
              <tr key={key} className="border-b last:border-0">
                <td className="py-2 px-3 font-medium text-muted-foreground">
                  {WEIGHT_LABELS[key]}
                </td>
                {custom && (
                  <td className="py-2 px-3 text-right tabular-nums">
                    {cVal != null ? cVal.toFixed(3) : "—"}
                  </td>
                )}
                {fangraphs && (
                  <td className="py-2 px-3 text-right tabular-nums">
                    {fVal != null ? fVal.toFixed(3) : "—"}
                  </td>
                )}
                {custom && fangraphs && (
                  <>
                    <td
                      className={`py-2 px-3 text-right tabular-nums ${
                        diff != null && diff > 0
                          ? "text-green-500"
                          : diff != null && diff < 0
                            ? "text-red-500"
                            : ""
                      }`}
                    >
                      {diff != null
                        ? `${diff >= 0 ? "+" : ""}${diff.toFixed(3)}`
                        : "—"}
                    </td>
                    <td
                      className={`py-2 px-3 text-right tabular-nums ${
                        pctDiff != null && pctDiff > 0
                          ? "text-green-500"
                          : pctDiff != null && pctDiff < 0
                            ? "text-red-500"
                            : ""
                      }`}
                    >
                      {pctDiff != null
                        ? `${pctDiff >= 0 ? "+" : ""}${pctDiff.toFixed(1)}%`
                        : "—"}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function pfColor(pf: number, min: number, max: number): string {
  // Map park factor to color: green (>1.0 hitter-friendly) to red (<1.0 pitcher-friendly)
  // Center on 1.0, not the data range midpoint
  const t = max === min ? 0.5 : (pf - min) / (max - min);
  const r = Math.round(220 - t * 180);
  const g = Math.round(60 + t * 160);
  const b = Math.round(60);
  return `rgb(${r}, ${g}, ${b})`;
}

function ParkFactorsTable({ factors }: { factors: ParkFactorRow[] }) {
  const pfs = factors.map((f) => f.park_factor);
  const min = Math.min(...pfs);
  const max = Math.max(...pfs);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="py-2 px-3 text-left font-medium border-b">Team</th>
            <th className="py-2 px-3 text-left font-medium border-b">Venue</th>
            <th className="py-2 px-3 text-center font-medium border-b">Home G</th>
            <th className="py-2 px-3 text-center font-medium border-b">Road G</th>
            <th className="py-2 px-3 text-center font-medium border-b">Home R/G</th>
            <th className="py-2 px-3 text-center font-medium border-b">Road R/G</th>
            <th className="py-2 px-3 text-center font-medium border-b">PF</th>
          </tr>
        </thead>
        <tbody>
          {factors.map((f) => (
            <tr key={f.team} className="border-b last:border-0">
              <td className="py-2 px-3 font-medium">{f.team}</td>
              <td className="py-2 px-3 text-muted-foreground">{f.venue}</td>
              <td className="py-2 px-3 text-center tabular-nums">{f.home_games}</td>
              <td className="py-2 px-3 text-center tabular-nums">{f.road_games}</td>
              <td className="py-2 px-3 text-center tabular-nums">{f.home_rpg.toFixed(2)}</td>
              <td className="py-2 px-3 text-center tabular-nums">{f.road_rpg.toFixed(2)}</td>
              <td
                className="py-2 px-3 text-center tabular-nums font-medium"
                style={{
                  backgroundColor: pfColor(f.park_factor, min, max),
                  color: "#fff",
                }}
              >
                {f.park_factor.toFixed(3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Analytics() {
  const [season, setSeason] = useState(2025);
  const reMatrix = useREMatrix(season);
  const linearWeights = useLinearWeights(season);
  const parkFactors = useParkFactors(season);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <select
          value={season}
          onChange={(e) => setSeason(Number(e.target.value))}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          {[2025, 2024, 2023, 2022, 2021].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Run Expectancy Matrix (RE24)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reMatrix.isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : reMatrix.data?.entries.length ? (
            <REMatrixGrid entries={reMatrix.data.entries} />
          ) : (
            <p className="text-muted-foreground">
              No RE24 data available for {season}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Linear Weights Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          {linearWeights.isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : linearWeights.data?.weights.length ? (
            <LinearWeightsTable weights={linearWeights.data.weights} />
          ) : (
            <p className="text-muted-foreground">
              No linear weights data available for {season}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Park Factors</CardTitle>
        </CardHeader>
        <CardContent>
          {parkFactors.isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : parkFactors.data?.factors.length ? (
            <ParkFactorsTable factors={parkFactors.data.factors} />
          ) : (
            <p className="text-muted-foreground">
              No park factors data available for {season}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
