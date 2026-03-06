import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComparePlayerStats } from "@/hooks/use-compare";

function fmtAvg(val: number | undefined | null): string {
  if (val == null) return "N/A";
  return val.toFixed(3).replace(/^0/, "");
}

function fmtPct(val: number | undefined | null): string {
  if (val == null) return "N/A";
  return `${val.toFixed(1)}%`;
}

function fmtNum(val: number | undefined | null, decimals = 0): string {
  if (val == null) return "N/A";
  return decimals > 0 ? val.toFixed(decimals) : String(Math.round(val));
}

interface StatRow {
  label: string;
  key: string;
  format: "avg" | "pct" | "num" | "num1";
  /** Higher is better? Used to highlight the best value. Default true. */
  higherIsBetter?: boolean;
}

const HITTING_STATS: StatRow[] = [
  { label: "PA", key: "pa", format: "num" },
  { label: "AB", key: "ab", format: "num" },
  { label: "H", key: "hits", format: "num" },
  { label: "HR", key: "home_runs", format: "num" },
  { label: "BB", key: "walks", format: "num" },
  { label: "K", key: "strikeouts", format: "num", higherIsBetter: false },
  { label: "AVG", key: "avg", format: "avg" },
  { label: "OBP", key: "obp", format: "avg" },
  { label: "SLG", key: "slg", format: "avg" },
  { label: "Exit Velo", key: "avg_exit_velo", format: "num1" },
  { label: "Barrel%", key: "barrel_pct", format: "pct" },
  { label: "Hard Hit%", key: "hard_hit_pct", format: "pct" },
];

const PITCHING_STATS: StatRow[] = [
  { label: "Pitches", key: "total_pitches", format: "num" },
  { label: "BF", key: "batters_faced", format: "num" },
  { label: "K", key: "strikeouts", format: "num" },
  { label: "BB", key: "walks", format: "num", higherIsBetter: false },
  { label: "K%", key: "k_pct", format: "pct" },
  { label: "BB%", key: "bb_pct", format: "pct", higherIsBetter: false },
  { label: "Whiff%", key: "whiff_pct", format: "pct" },
  { label: "Avg Velo", key: "avg_velo", format: "num1" },
  { label: "Avg Spin", key: "avg_spin", format: "num" },
];

function formatValue(val: number | undefined | null, format: StatRow["format"]): string {
  switch (format) {
    case "avg":
      return fmtAvg(val);
    case "pct":
      return fmtPct(val);
    case "num1":
      return fmtNum(val, 1);
    case "num":
    default:
      return fmtNum(val);
  }
}

function findBestIndex(
  players: ComparePlayerStats[],
  key: string,
  section: "hitting" | "pitching",
  higherIsBetter: boolean,
): number {
  let bestIdx = -1;
  let bestVal: number | null = null;
  players.forEach((p, idx) => {
    const stats = section === "hitting" ? p.hitting : p.pitching;
    if (!stats) return;
    const val = stats[key] as number | null | undefined;
    if (val == null) return;
    if (
      bestVal == null ||
      (higherIsBetter ? val > bestVal : val < bestVal)
    ) {
      bestVal = val;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

function StatSection({
  title,
  statRows,
  players,
  section,
}: {
  title: string;
  statRows: StatRow[];
  players: ComparePlayerStats[];
  section: "hitting" | "pitching";
}) {
  // Check if any player has data for this section
  const hasData = players.some(
    (p) => (section === "hitting" ? p.hitting : p.pitching) != null,
  );
  if (!hasData) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Stat</TableHead>
              {players.map((p) => (
                <TableHead key={p.player_id} className="text-right">
                  {p.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {statRows.map((stat) => {
              const higherIsBetter = stat.higherIsBetter ?? true;
              const bestIdx = findBestIndex(
                players,
                stat.key,
                section,
                higherIsBetter,
              );

              return (
                <TableRow key={stat.key}>
                  <TableCell className="font-medium text-muted-foreground">
                    {stat.label}
                  </TableCell>
                  {players.map((p, idx) => {
                    const stats =
                      section === "hitting" ? p.hitting : p.pitching;
                    const val = stats
                      ? (stats[stat.key] as number | null | undefined)
                      : null;
                    const isBest = idx === bestIdx && players.length > 1;

                    return (
                      <TableCell
                        key={p.player_id}
                        className={`text-right tabular-nums ${
                          isBest
                            ? "font-bold text-primary"
                            : ""
                        }`}
                      >
                        {stats ? formatValue(val, stat.format) : "N/A"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface ComparisonTableProps {
  players: ComparePlayerStats[];
}

export default function ComparisonTable({ players }: ComparisonTableProps) {
  if (players.length === 0) return null;

  return (
    <div className="space-y-6">
      <StatSection
        title="Hitting Comparison"
        statRows={HITTING_STATS}
        players={players}
        section="hitting"
      />
      <StatSection
        title="Pitching Comparison"
        statRows={PITCHING_STATS}
        players={players}
        section="pitching"
      />
    </div>
  );
}
