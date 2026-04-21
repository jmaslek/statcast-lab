import { useState, useMemo, memo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { pitchResultColor } from "@/lib/chart-utils";
import WinProbabilityChart from "@/components/d3/WinProbabilityChart";
import PitchVelocityChart from "@/components/d3/PitchVelocityChart";
import type {
  BoxscoreData,
  BoxscoreTeam,
  GameDetail,
  PitchDetail,
} from "@/hooks/use-games";

// ---- Types for drill-down ----

interface AtBat {
  atBatNumber: number;
  batter: number;
  batterName: string | null;
  pitcher: number;
  pitcherName: string | null;
  pitches: PitchDetail[];
  result: string | null;
}

interface HalfInningKey {
  inning: number;
  topbot: "Top" | "Bot";
}

// ---- Helpers ----

function eventBadgeVariant(
  event: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (!event) return "outline";
  const e = event.toLowerCase();
  if (e.includes("home_run") || e.includes("triple") || e.includes("double") || e.includes("single"))
    return "default";
  if (e.includes("strikeout")) return "destructive";
  if (e.includes("walk") || e.includes("hit_by_pitch")) return "secondary";
  return "outline";
}

function getHalfInningAtBats(
  pitches: PitchDetail[],
  inning: number,
  topbot: string,
): AtBat[] {
  const map = new Map<number, AtBat>();
  for (const p of pitches) {
    if (p.inning !== inning || p.inning_topbot !== topbot) continue;
    if (!map.has(p.at_bat_number)) {
      map.set(p.at_bat_number, {
        atBatNumber: p.at_bat_number,
        batter: p.batter,
        batterName: p.batter_name,
        pitcher: p.pitcher,
        pitcherName: p.pitcher_name,
        pitches: [],
        result: null,
      });
    }
    const ab = map.get(p.at_bat_number)!;
    ab.pitches.push(p);
    if (p.events) ab.result = p.events;
  }
  return Array.from(map.values());
}

// ---- Linescore cell ----

function LinescoreCell({
  value,
  isSelected,
  onClick,
  label,
  bold,
}: {
  value: number;
  isSelected: boolean;
  onClick: () => void;
  label: string;
  bold?: boolean;
}) {
  return (
    <td className="p-0">
      <button
        onClick={onClick}
        className={`w-full py-2 px-2 text-center tabular-nums transition-colors ${
          isSelected
            ? "bg-primary text-primary-foreground font-bold"
            : bold
              ? "font-bold hover:bg-muted/80"
              : "hover:bg-muted/80 text-muted-foreground"
        }`}
        aria-label={label}
        aria-pressed={isSelected}
      >
        {value}
      </button>
    </td>
  );
}

// ---- Mini strike zone ----

function MiniZone({ pitches }: { pitches: PitchDetail[] }) {
  const zoneW = 48;
  const zoneH = 56;
  const pad = 6;
  const svgW = zoneW + pad * 2;
  const svgH = zoneH + pad * 2;
  const toX = (px: number) => pad + ((px + 1.5) / 3.0) * zoneW;
  const toY = (pz: number) => pad + ((4.5 - pz) / 4.0) * zoneH;

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="shrink-0">
      <rect
        x={toX(-0.83)} y={toY(3.5)}
        width={toX(0.83) - toX(-0.83)}
        height={toY(1.5) - toY(3.5)}
        fill="none" stroke="currentColor" className="text-muted-foreground"
        strokeWidth="0.75" strokeDasharray="2,1.5"
      />
      {pitches
        .filter((p) => p.plate_x !== null && p.plate_z !== null)
        .map((p, i) => (
          <circle key={i} cx={toX(p.plate_x!)} cy={toY(p.plate_z!)} r={2.5}
            fill={pitchResultColor(p.description)} opacity={0.85}
          />
        ))}
    </svg>
  );
}

// ---- Half-inning detail (drill-down from linescore click) ----

function HalfInningDetail({
  atBats,
  inning,
  topbot,
  teamName,
}: {
  atBats: AtBat[];
  inning: number;
  topbot: string;
  teamName: string;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="text-sm font-semibold">
        {topbot === "Top" ? "Top" : "Bottom"} {inning} &mdash; {teamName} batting
      </h3>
      {atBats.length === 0 ? (
        <p className="text-sm text-muted-foreground">No at-bats this half-inning.</p>
      ) : (
        <div className="space-y-2">
          {atBats.map((ab) => (
            <div key={ab.atBatNumber} className="flex items-start gap-3 py-2 border-b last:border-0">
              <MiniZone pitches={ab.pitches} />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{ab.batterName ?? ab.batter}</span>
                  <span className="text-xs text-muted-foreground">vs {ab.pitcherName ?? ab.pitcher}</span>
                  {ab.result && (
                    <Badge variant={eventBadgeVariant(ab.result)} className="text-xs">
                      {ab.result.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {ab.pitches.map((p) => (
                    <span key={p.pitch_number} className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"
                      title={p.description.replace(/_/g, " ")}
                    >
                      {p.pitch_type && <span className="font-medium">{p.pitch_type}</span>}
                      {p.release_speed && <span className="tabular-nums">{Math.round(p.release_speed)}</span>}
                      {p.pitch_number < ab.pitches.length && (
                        <span className="text-muted-foreground/50 mx-0.5">&middot;</span>
                      )}
                    </span>
                  ))}
                </div>
                {ab.pitches.at(-1)?.launch_speed != null && (
                  <span className="text-xs text-muted-foreground">
                    {ab.pitches.at(-1)!.launch_speed!.toFixed(1)} mph
                    {ab.pitches.at(-1)!.launch_angle != null &&
                      ` \u00B7 ${ab.pitches.at(-1)!.launch_angle!.toFixed(0)}\u00B0`}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Batting order table ----

const BattingTable = memo(function BattingTable({ team }: { team: BoxscoreTeam }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Batter</TableHead>
            <TableHead className="w-10 text-center">Pos</TableHead>
            <TableHead className="text-right">AB</TableHead>
            <TableHead className="text-right">R</TableHead>
            <TableHead className="text-right">H</TableHead>
            <TableHead className="text-right">RBI</TableHead>
            <TableHead className="text-right">BB</TableHead>
            <TableHead className="text-right">K</TableHead>
            <TableHead className="text-right">AVG</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {team.batters.map((b) => (
            <TableRow key={b.player_id}>
              <TableCell className="font-medium">
                {b.batting_order && (
                  <span className="text-xs text-muted-foreground mr-1.5">{b.batting_order}</span>
                )}
                {b.name}
              </TableCell>
              <TableCell className="text-center text-muted-foreground text-xs">{b.position}</TableCell>
              <TableCell className="text-right tabular-nums">{b.ab}</TableCell>
              <TableCell className="text-right tabular-nums">{b.r}</TableCell>
              <TableCell className="text-right tabular-nums">{b.h}</TableCell>
              <TableCell className="text-right tabular-nums">{b.rbi}</TableCell>
              <TableCell className="text-right tabular-nums">{b.bb}</TableCell>
              <TableCell className="text-right tabular-nums">{b.k}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{b.avg}</TableCell>
            </TableRow>
          ))}
          {/* Team totals */}
          <TableRow className="border-t-2 font-semibold">
            <TableCell colSpan={2}>Totals</TableCell>
            <TableCell className="text-right tabular-nums">{team.batters.reduce((s, b) => s + b.ab, 0)}</TableCell>
            <TableCell className="text-right tabular-nums">{team.totals.runs}</TableCell>
            <TableCell className="text-right tabular-nums">{team.totals.hits}</TableCell>
            <TableCell className="text-right tabular-nums">{team.batters.reduce((s, b) => s + b.rbi, 0)}</TableCell>
            <TableCell className="text-right tabular-nums">{team.batters.reduce((s, b) => s + b.bb, 0)}</TableCell>
            <TableCell className="text-right tabular-nums">{team.batters.reduce((s, b) => s + b.k, 0)}</TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
});

// ---- Pitching table ----

function PitchingTable({ team }: { team: BoxscoreTeam }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pitcher</TableHead>
            <TableHead className="text-right">IP</TableHead>
            <TableHead className="text-right">H</TableHead>
            <TableHead className="text-right">R</TableHead>
            <TableHead className="text-right">ER</TableHead>
            <TableHead className="text-right">BB</TableHead>
            <TableHead className="text-right">K</TableHead>
            <TableHead className="text-right">P-S</TableHead>
            <TableHead className="text-right">ERA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {team.pitchers.map((p) => (
            <TableRow key={p.player_id}>
              <TableCell className="font-medium">
                {p.name}
                {p.note && (
                  <span className="text-xs text-muted-foreground ml-1.5">({p.note})</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{p.ip}</TableCell>
              <TableCell className="text-right tabular-nums">{p.h}</TableCell>
              <TableCell className="text-right tabular-nums">{p.r}</TableCell>
              <TableCell className="text-right tabular-nums">{p.er}</TableCell>
              <TableCell className="text-right tabular-nums">{p.bb}</TableCell>
              <TableCell className="text-right tabular-nums">{p.k}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{p.pitches}-{p.strikes}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{p.era}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---- Main component ----

interface BoxscoreProps {
  boxscore: BoxscoreData | undefined;
  gameDetail: GameDetail | undefined;
  isLoading: boolean;
}

export function Boxscore({ boxscore, gameDetail, isLoading }: BoxscoreProps) {
  const [selected, setSelected] = useState<HalfInningKey | null>(null);

  const selectedAtBats = useMemo(() => {
    if (!gameDetail || !selected) return [];
    return getHalfInningAtBats(gameDetail.pitches, selected.inning, selected.topbot);
  }, [gameDetail, selected]);

  const awayErrors = useMemo(
    () => boxscore?.innings.reduce((s, i) => s + i.away_errors, 0) ?? 0,
    [boxscore?.innings],
  );
  const homeErrors = useMemo(
    () => boxscore?.innings.reduce((s, i) => s + i.home_errors, 0) ?? 0,
    [boxscore?.innings],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!boxscore) return null;

  function toggleCell(inning: number, topbot: "Top" | "Bot") {
    setSelected((prev) =>
      prev && prev.inning === inning && prev.topbot === topbot
        ? null
        : { inning, topbot },
    );
  }

  return (
    <div className="space-y-6">
      {/* Linescore */}
      <div className="rounded-lg border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <h2 className="text-lg font-bold">
            {boxscore.away.team_name} @ {boxscore.home.team_name}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-2 px-3 text-left font-semibold w-16" />
                {boxscore.innings.map((inn) => (
                  <th key={inn.num} className="py-2 px-1.5 text-center font-medium tabular-nums min-w-[2rem]">
                    {inn.num}
                  </th>
                ))}
                <th className="py-2 px-2 text-center font-semibold border-l min-w-[2rem]">R</th>
                <th className="py-2 px-2 text-center font-semibold min-w-[2rem]">H</th>
                <th className="py-2 px-2 text-center font-semibold min-w-[2rem]">E</th>
              </tr>
            </thead>
            <tbody>
              {/* Away */}
              <tr className="border-b">
                <td className="py-2 px-3 font-semibold">{boxscore.away.team_name}</td>
                {boxscore.innings.map((inn) => (
                  <LinescoreCell
                    key={inn.num}
                    value={inn.away_runs}
                    bold={inn.away_runs > 0}
                    isSelected={selected?.inning === inn.num && selected?.topbot === "Top"}
                    onClick={() => toggleCell(inn.num, "Top")}
                    label={`Top ${inn.num}: ${inn.away_runs} runs, ${inn.away_hits} hits`}
                  />
                ))}
                <td className="py-2 px-2 text-center tabular-nums font-bold border-l">{boxscore.away.totals.runs}</td>
                <td className="py-2 px-2 text-center tabular-nums font-medium">{boxscore.away.totals.hits}</td>
                <td className="py-2 px-2 text-center tabular-nums text-muted-foreground">
                  {awayErrors}
                </td>
              </tr>
              {/* Home */}
              <tr>
                <td className="py-2 px-3 font-semibold">{boxscore.home.team_name}</td>
                {boxscore.innings.map((inn) => (
                  <LinescoreCell
                    key={inn.num}
                    value={inn.home_runs}
                    bold={inn.home_runs > 0}
                    isSelected={selected?.inning === inn.num && selected?.topbot === "Bot"}
                    onClick={() => toggleCell(inn.num, "Bot")}
                    label={`Bottom ${inn.num}: ${inn.home_runs} runs, ${inn.home_hits} hits`}
                  />
                ))}
                <td className="py-2 px-2 text-center tabular-nums font-bold border-l">{boxscore.home.totals.runs}</td>
                <td className="py-2 px-2 text-center tabular-nums font-medium">{boxscore.home.totals.hits}</td>
                <td className="py-2 px-2 text-center tabular-nums text-muted-foreground">
                  {homeErrors}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground px-4 py-2 border-t">
          Click any inning cell to see at-bats with pitch-by-pitch data
        </p>
      </div>

      {/* Win probability chart */}
      {gameDetail && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Win Probability</h3>
          <WinProbabilityChart
            pitches={gameDetail.pitches}
            homeTeam={boxscore.home.team_name}
            awayTeam={boxscore.away.team_name}
          />
        </div>
      )}

      {/* Pitch velocity chart */}
      {gameDetail && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Pitch Velocities</h3>
          <PitchVelocityChart pitches={gameDetail.pitches} />
        </div>
      )}

      {/* Drill-down for selected half-inning */}
      {selected && gameDetail && (
        <HalfInningDetail
          atBats={selectedAtBats}
          inning={selected.inning}
          topbot={selected.topbot}
          teamName={selected.topbot === "Top" ? boxscore.away.team_name : boxscore.home.team_name}
        />
      )}

      {/* Batting tables */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{boxscore.away.team_name} Batting</h3>
        <BattingTable team={boxscore.away} />
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{boxscore.home.team_name} Batting</h3>
        <BattingTable team={boxscore.home} />
      </div>

      {/* Pitching tables */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{boxscore.away.team_name} Pitching</h3>
        <PitchingTable team={boxscore.away} />
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{boxscore.home.team_name} Pitching</h3>
        <PitchingTable team={boxscore.home} />
      </div>
    </div>
  );
}
