import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/QueryError";
import { useStandings } from "@/hooks/use-standings";
import type { DivisionStandings, TeamRecord } from "@/hooks/use-standings";
import { SEASONS, DEFAULT_SEASON } from "@/lib/constants";

function pythagWinPct(rs: number, ra: number, exp: number): number {
  if (rs === 0 && ra === 0) return 0.5;
  const rsX = Math.pow(rs, exp);
  const raX = Math.pow(ra, exp);
  return rsX / (rsX + raX);
}

function DivisionTable({ division, pythagExp }: { division: DivisionStandings; pythagExp: number }) {
  // Strip league name prefix for a cleaner header (e.g. "East" from "American League East")
  const shortName = division.division_name.replace(/^(American|National) League /, "");
  const leaguePrefix = division.league_name.includes("American") ? "AL" : "NL";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          {leaguePrefix} {shortName}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 px-3 text-left font-medium">Team</th>
                <th className="py-2 px-3 text-center font-medium">W</th>
                <th className="py-2 px-3 text-center font-medium">L</th>
                <th className="py-2 px-3 text-center font-medium">PCT</th>
                <th className="py-2 px-3 text-center font-medium">GB</th>
                <th className="py-2 px-3 text-center font-medium hidden sm:table-cell">Home</th>
                <th className="py-2 px-3 text-center font-medium hidden sm:table-cell">Away</th>
                <th className="py-2 px-3 text-center font-medium hidden md:table-cell">L10</th>
                <th className="py-2 px-3 text-center font-medium hidden md:table-cell">STRK</th>
                <th className="py-2 px-3 text-center font-medium hidden lg:table-cell">RS</th>
                <th className="py-2 px-3 text-center font-medium hidden lg:table-cell">RA</th>
                <th className="py-2 px-3 text-center font-medium hidden lg:table-cell">DIFF</th>
                <th className="py-2 px-3 text-center font-medium hidden lg:table-cell">xW%</th>
              </tr>
            </thead>
            <tbody>
              {division.teams.map((team) => (
                <TeamRow key={team.team_id} team={team} pythagExp={pythagExp} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamRow({ team, pythagExp }: { team: TeamRecord; pythagExp: number }) {
  const diffColor =
    team.run_diff > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : team.run_diff < 0
        ? "text-rose-600 dark:text-rose-400"
        : "";

  const xWPct = pythagWinPct(team.runs_scored, team.runs_allowed, pythagExp);

  return (
    <tr className="border-b last:border-0 hover:bg-muted/50">
      <td className="py-2 px-3 font-medium">
        {team.team_abbrev}
      </td>
      <td className="py-2 px-3 text-center tabular-nums">{team.wins}</td>
      <td className="py-2 px-3 text-center tabular-nums">{team.losses}</td>
      <td className="py-2 px-3 text-center tabular-nums">{team.pct}</td>
      <td className="py-2 px-3 text-center tabular-nums">{team.gb}</td>
      <td className="py-2 px-3 text-center tabular-nums hidden sm:table-cell">{team.home_record}</td>
      <td className="py-2 px-3 text-center tabular-nums hidden sm:table-cell">{team.away_record}</td>
      <td className="py-2 px-3 text-center tabular-nums hidden md:table-cell">{team.last_ten}</td>
      <td className="py-2 px-3 text-center tabular-nums hidden md:table-cell">{team.streak}</td>
      <td className="py-2 px-3 text-center tabular-nums hidden lg:table-cell">{team.runs_scored}</td>
      <td className="py-2 px-3 text-center tabular-nums hidden lg:table-cell">{team.runs_allowed}</td>
      <td className={`py-2 px-3 text-center tabular-nums font-medium hidden lg:table-cell ${diffColor}`}>
        {team.run_diff > 0 ? "+" : ""}{team.run_diff}
      </td>
      <td className="py-2 px-3 text-center tabular-nums hidden lg:table-cell">
        {xWPct.toFixed(3).replace(/^0/, "")}
      </td>
    </tr>
  );
}

const PYTHAG_PRESETS = [
  { value: 1.83, label: "Pythagenpat (1.83)" },
  { value: 2.0, label: "Classic (2.0)" },
];

export default function Standings() {
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [pythagExp, setPythagExp] = useState(2.0);
  const seasonId = "standings-season";
  const standings = useStandings(season);

  const alDivisions = useMemo(
    () => standings.data?.divisions.filter((d) => d.league_name.includes("American")) ?? [],
    [standings.data?.divisions],
  );
  const nlDivisions = useMemo(
    () => standings.data?.divisions.filter((d) => d.league_name.includes("National")) ?? [],
    [standings.data?.divisions],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Standings</h1>
        <div className="flex items-center gap-4">
          <label htmlFor={seasonId} className="text-sm font-medium">Season</label>
          <Select
            value={String(season)}
            onValueChange={(v) => setSeason(Number(v))}
          >
            <SelectTrigger id={seasonId} className="w-28">
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
      </div>

      {/* Pythagorean exponent control */}
      <div className="flex items-center gap-4 rounded-lg border p-3 bg-muted/30">
        <div className="text-sm">
          <span className="font-medium">Pythagorean Exponent:</span>{" "}
          <span className="tabular-nums font-bold">{pythagExp.toFixed(2)}</span>
        </div>
        <Slider
          value={[pythagExp]}
          onValueChange={([v]) => setPythagExp(v)}
          min={1.5}
          max={2.5}
          step={0.01}
          className="w-48"
        />
        <div className="flex gap-1">
          {PYTHAG_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPythagExp(p.value)}
              aria-label={`Set exponent to ${p.label}`}
              aria-pressed={Math.abs(pythagExp - p.value) < 0.005}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                Math.abs(pythagExp - p.value) < 0.005
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          xW/xL = RS^x / (RS^x + RA^x)
        </span>
      </div>

      {standings.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[200px] w-full" />
          ))}
        </div>
      ) : standings.isError ? (
        <QueryError message="Failed to load standings." onRetry={() => standings.refetch()} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-muted-foreground">American League</h2>
            {alDivisions.map((d) => (
              <DivisionTable key={d.division_name} division={d} pythagExp={pythagExp} />
            ))}
          </div>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-muted-foreground">National League</h2>
            {nlDivisions.map((d) => (
              <DivisionTable key={d.division_name} division={d} pythagExp={pythagExp} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
