import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pitchColor } from "@/lib/chart-utils";
import type { PitchUsageByCountData, PitchUsageByCountCell } from "@/types/player";

type Metric = "usage_pct" | "avg_velo" | "whiff_pct";

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: "usage_pct", label: "Usage %" },
  { value: "avg_velo", label: "Avg Velo" },
  { value: "whiff_pct", label: "Whiff %" },
];

function cellOpacity(usage: number): number {
  // Scale opacity by usage %: higher usage = more opaque
  return Math.min(0.15 + (usage / 100) * 0.85, 1);
}

function formatMetric(val: number | null, metric: Metric): string {
  if (val == null) return "";
  if (metric === "usage_pct") return `${val.toFixed(0)}%`;
  if (metric === "avg_velo") return val.toFixed(1);
  if (metric === "whiff_pct") return val != null ? `${val.toFixed(0)}%` : "";
  return String(val);
}

export default function PitchUsageByCount({ data }: { data: PitchUsageByCountData }) {
  const [metric, setMetric] = useState<Metric>("usage_pct");

  // Build lookup: count_state -> pitch_type -> cell
  const lookup = new Map<string, Map<string, PitchUsageByCountCell>>();
  for (const cell of data.cells) {
    if (!lookup.has(cell.count_state)) lookup.set(cell.count_state, new Map());
    lookup.get(cell.count_state)!.set(cell.pitch_type, cell);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {data.pitch_types.map((pt) => (
            <span key={pt} className="flex items-center gap-1 text-xs">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ backgroundColor: pitchColor(pt) }}
              />
              {data.pitch_names[pt] ?? pt}
            </span>
          ))}
        </div>
        <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METRIC_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="py-2 px-2 text-left font-medium border-b">Count</th>
              {data.pitch_types.map((pt) => (
                <th key={pt} className="py-2 px-2 text-center font-medium border-b">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: pitchColor(pt) }}
                  />
                  {pt}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.counts.map((count) => {
              const countCells = lookup.get(count);
              return (
                <tr key={count} className="border-b last:border-0">
                  <td className="py-2 px-2 font-medium tabular-nums">{count}</td>
                  {data.pitch_types.map((pt) => {
                    const cell = countCells?.get(pt);
                    if (!cell) {
                      return (
                        <td key={pt} className="py-2 px-2 text-center text-muted-foreground">
                          —
                        </td>
                      );
                    }
                    const val = cell[metric];
                    const opacity = metric === "usage_pct" ? cellOpacity(cell.usage_pct) : 0.6;
                    return (
                      <td
                        key={pt}
                        className="py-2 px-2 text-center tabular-nums font-medium"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${pitchColor(pt)} ${Math.round(opacity * 100)}%, transparent)`,
                        }}
                        title={`${count} | ${data.pitch_names[pt] ?? pt}: ${cell.num_pitches} pitches, ${cell.usage_pct.toFixed(1)}% usage${cell.avg_velo ? `, ${cell.avg_velo.toFixed(1)} mph` : ""}${cell.whiff_pct != null ? `, ${cell.whiff_pct.toFixed(1)}% whiff` : ""}`}
                      >
                        {formatMetric(val, metric)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Cell color intensity represents pitch usage percentage within each count.
        Hover for details.
      </p>
    </div>
  );
}
