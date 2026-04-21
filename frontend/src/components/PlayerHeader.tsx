import { Skeleton } from "@/components/ui/skeleton";
import { fmtAvg, fmtPct } from "@/lib/format";
import type { Player, PlayerStats } from "@/types/player";

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-1.5 min-w-[72px]">
      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{label}</span>
      <span className="text-xl font-bold tabular-nums tracking-tight">{value}</span>
    </div>
  );
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
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b bg-muted/30">
          <Skeleton className="h-7 w-56" />
        </div>
        <div className="px-5 py-3 flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-20" />
          ))}
        </div>
      </div>
    );
  }

  if (!player) return null;

  const hitting = stats?.hitting;
  const pitching = stats?.pitching;

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b bg-muted/30">
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl tracking-tight">{player.name_full}</h2>
          <span className="text-sm font-medium text-muted-foreground">{player.position}</span>
          <span className="text-sm font-bold text-primary">{player.team}</span>
        </div>
      </div>
      <div className="px-5 py-3 flex flex-wrap gap-x-8 gap-y-3">
        {hitting && (
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Hitting
            </p>
            <div className="flex divide-x">
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
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Pitching
            </p>
            <div className="flex divide-x">
              <StatBox label="K%" value={fmtPct(pitching.k_pct)} />
              <StatBox label="BB%" value={fmtPct(pitching.bb_pct)} />
              <StatBox label="Whiff%" value={fmtPct(pitching.whiff_pct)} />
              <StatBox label="CSW%" value={fmtPct(pitching.csw_pct)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
