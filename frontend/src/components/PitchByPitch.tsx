import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GameDetail, PitchDetail } from "@/hooks/use-games";

interface AtBat {
  atBatNumber: number;
  inning: number;
  inningTopbot: string;
  pitcher: number;
  batter: number;
  pitches: PitchDetail[];
  result: string | null;
}

/** Color for at-bat result events */
function eventColor(
  event: string | null
): "default" | "secondary" | "destructive" | "outline" {
  if (!event) return "outline";
  const e = event.toLowerCase();
  if (
    e.includes("home_run") ||
    e.includes("triple") ||
    e.includes("double") ||
    e.includes("single")
  )
    return "default";
  if (e.includes("strikeout") || e.includes("strike")) return "destructive";
  if (e.includes("walk") || e.includes("hit_by_pitch")) return "secondary";
  return "outline";
}

/** Format inning label like "T1", "B3" */
function inningLabel(inning: number, topbot: string): string {
  return `${topbot === "Top" ? "T" : "B"}${inning}`;
}

/** Mini inline strike zone SVG */
function MiniStrikeZone({ pitches }: { pitches: PitchDetail[] }) {
  // Strike zone is roughly -0.83 to 0.83 in x, 1.5 to 3.5 in z
  const zoneW = 60;
  const zoneH = 70;
  const pad = 10;
  const svgW = zoneW + pad * 2;
  const svgH = zoneH + pad * 2;

  function toSvgX(plateX: number): number {
    // plate_x ranges roughly -1.5 to 1.5, zone is -0.83 to 0.83
    return pad + ((plateX + 1.5) / 3.0) * zoneW;
  }

  function toSvgY(plateZ: number): number {
    // plate_z ranges roughly 0.5 to 4.5, zone is 1.5 to 3.5
    return pad + ((4.5 - plateZ) / 4.0) * zoneH;
  }

  function pitchColor(desc: string): string {
    const d = desc.toLowerCase();
    if (d.includes("called_strike") || d.includes("swinging_strike"))
      return "#ef4444";
    if (d.includes("ball") || d.includes("blocked")) return "#3b82f6";
    if (d.includes("foul")) return "#f59e0b";
    if (d.includes("hit_into_play")) return "#22c55e";
    return "#94a3b8";
  }

  return (
    <svg
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="inline-block"
    >
      {/* Strike zone box */}
      <rect
        x={toSvgX(-0.83)}
        y={toSvgY(3.5)}
        width={toSvgX(0.83) - toSvgX(-0.83)}
        height={toSvgY(1.5) - toSvgY(3.5)}
        fill="none"
        stroke="#71717a"
        strokeWidth="1"
        strokeDasharray="3,2"
      />
      {/* Pitch locations */}
      {pitches
        .filter((p) => p.plate_x !== null && p.plate_z !== null)
        .map((p, i) => (
          <circle
            key={i}
            cx={toSvgX(p.plate_x!)}
            cy={toSvgY(p.plate_z!)}
            r={3}
            fill={pitchColor(p.description)}
            opacity={0.8}
          />
        ))}
    </svg>
  );
}

interface PitchByPitchProps {
  game: GameDetail | undefined;
  isLoading: boolean;
}

export function PitchByPitch({ game, isLoading }: PitchByPitchProps) {
  const [expandedAtBats, setExpandedAtBats] = useState<Set<number>>(new Set());

  const atBats = useMemo(() => {
    if (!game) return [];
    const map = new Map<number, AtBat>();
    for (const pitch of game.pitches) {
      if (!map.has(pitch.at_bat_number)) {
        map.set(pitch.at_bat_number, {
          atBatNumber: pitch.at_bat_number,
          inning: pitch.inning,
          inningTopbot: pitch.inning_topbot,
          pitcher: pitch.pitcher,
          batter: pitch.batter,
          pitches: [],
          result: null,
        });
      }
      const ab = map.get(pitch.at_bat_number)!;
      ab.pitches.push(pitch);
      if (pitch.events) {
        ab.result = pitch.events;
      }
    }
    return Array.from(map.values());
  }, [game]);

  function toggleAtBat(num: number) {
    setExpandedAtBats((prev) => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        next.add(num);
      }
      return next;
    });
  }

  function expandAll() {
    setExpandedAtBats(new Set(atBats.map((ab) => ab.atBatNumber)));
  }

  function collapseAll() {
    setExpandedAtBats(new Set());
  }

  if (isLoading) {
    return (
      <div className="space-y-3 mt-6">
        <Skeleton className="h-8 w-64" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!game) {
    return null;
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {game.away_team} @ {game.home_team} &mdash; Pitch-by-Pitch
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {game.total_pitches} total pitches across {atBats.length} at-bats
      </p>

      <div className="space-y-2">
        {atBats.map((ab) => {
          const isExpanded = expandedAtBats.has(ab.atBatNumber);
          return (
            <div
              key={ab.atBatNumber}
              className="border rounded-lg overflow-hidden"
            >
              {/* At-bat header */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                onClick={() => toggleAtBat(ab.atBatNumber)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-medium text-muted-foreground w-8">
                    {inningLabel(ab.inning, ab.inningTopbot)}
                  </span>
                  <span className="text-sm">
                    P:{ab.pitcher} vs B:{ab.batter}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({ab.pitches.length} pitch
                    {ab.pitches.length !== 1 ? "es" : ""})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {ab.result && (
                    <Badge variant={eventColor(ab.result)}>
                      {ab.result.replace(/_/g, " ")}
                    </Badge>
                  )}
                  <MiniStrikeZone pitches={ab.pitches} />
                  <span className="text-muted-foreground text-sm">
                    {isExpanded ? "\u25B2" : "\u25BC"}
                  </span>
                </div>
              </button>

              {/* Expanded pitch details */}
              {isExpanded && (
                <div className="border-t px-4 py-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Speed</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Exit Velo</TableHead>
                        <TableHead>Launch Angle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ab.pitches.map((p) => (
                        <TableRow key={p.pitch_number}>
                          <TableCell className="font-mono text-muted-foreground">
                            {p.pitch_number}
                          </TableCell>
                          <TableCell>
                            {p.pitch_type ? (
                              <Badge variant="outline">{p.pitch_type}</Badge>
                            ) : (
                              <span className="text-muted-foreground">--</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {p.release_speed
                              ? `${p.release_speed.toFixed(1)} mph`
                              : "--"}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {p.description.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {p.plate_x !== null && p.plate_z !== null
                              ? `(${p.plate_x.toFixed(2)}, ${p.plate_z.toFixed(2)})`
                              : "--"}
                          </TableCell>
                          <TableCell>
                            {p.launch_speed
                              ? `${p.launch_speed.toFixed(1)} mph`
                              : "--"}
                          </TableCell>
                          <TableCell>
                            {p.launch_angle !== null
                              ? `${p.launch_angle.toFixed(1)}\u00B0`
                              : "--"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
