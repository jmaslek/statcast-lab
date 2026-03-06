import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Player, PlayerStats } from "@/types/player";

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border bg-muted/50 px-4 py-2 min-w-[80px]">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className="text-lg font-bold tabular-nums">{value}</span>
    </div>
  );
}

function fmtAvg(val: number): string {
  return val.toFixed(3).replace(/^0/, "");
}

function fmtPct(val: number): string {
  return `${val.toFixed(1)}%`;
}

interface PlayerHeaderProps {
  player: Player | undefined;
  stats: PlayerStats | undefined;
  isLoading: boolean;
}

export default function PlayerHeader({
  player,
  stats,
  isLoading,
}: PlayerHeaderProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!player) return null;

  const hitting = stats?.hitting;
  const pitching = stats?.pitching;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle className="text-2xl">{player.name_full}</CardTitle>
          <Badge variant="secondary">{player.position}</Badge>
          <Badge variant="outline">{player.team}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-6">
          {hitting && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Hitting
              </p>
              <div className="flex gap-2">
                <StatBox label="AVG" value={fmtAvg(hitting.avg)} />
                <StatBox label="OBP" value={fmtAvg(hitting.obp)} />
                <StatBox label="SLG" value={fmtAvg(hitting.slg)} />
                <StatBox
                  label="OPS"
                  value={fmtAvg(hitting.obp + hitting.slg)}
                />
              </div>
            </div>
          )}
          {pitching && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Pitching
              </p>
              <div className="flex gap-2">
                <StatBox label="K%" value={fmtPct(pitching.k_pct)} />
                <StatBox label="BB%" value={fmtPct(pitching.bb_pct)} />
                <StatBox label="Whiff%" value={fmtPct(pitching.whiff_pct)} />
                <StatBox label="CSW%" value={fmtPct(pitching.csw_pct)} />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
