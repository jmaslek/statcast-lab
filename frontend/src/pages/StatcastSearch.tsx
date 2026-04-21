import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEASONS, DEFAULT_SEASON, TEAMS } from "@/lib/constants";
import { useSearchPitches, useSearchAggregate } from "@/hooks/use-search";
import type { SearchFilters, SearchPitch, SearchAggRow } from "@/types/search";
import { pitchColor } from "@/lib/chart-utils";
import { QueryError } from "@/components/QueryError";

const PITCH_TYPES = [
  { value: "all", label: "All Pitch Types" },
  { value: "FF", label: "4-Seam Fastball" },
  { value: "SI", label: "Sinker" },
  { value: "FC", label: "Cutter" },
  { value: "SL", label: "Slider" },
  { value: "ST", label: "Sweeper" },
  { value: "CU", label: "Curveball" },
  { value: "CH", label: "Changeup" },
  { value: "FS", label: "Splitter" },
  { value: "KC", label: "Knuckle Curve" },
  { value: "SV", label: "Slurve" },
];

const EVENTS = [
  { value: "all", label: "All Results" },
  { value: "single", label: "Single" },
  { value: "double", label: "Double" },
  { value: "triple", label: "Triple" },
  { value: "home_run", label: "Home Run" },
  { value: "strikeout", label: "Strikeout" },
  { value: "walk", label: "Walk" },
  { value: "field_out", label: "Field Out" },
  { value: "grounded_into_double_play", label: "GIDP" },
  { value: "hit_by_pitch", label: "HBP" },
];

const BB_TYPES = [
  { value: "all", label: "All Batted Balls" },
  { value: "fly_ball", label: "Fly Ball" },
  { value: "ground_ball", label: "Ground Ball" },
  { value: "line_drive", label: "Line Drive" },
  { value: "popup", label: "Popup" },
];

const COUNTS = [
  { value: "all", label: "Any" },
  { value: "0", label: "0" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
];

const STRIKES_OPTIONS = [
  { value: "all", label: "Any" },
  { value: "0", label: "0" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
];

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
  className = "w-full",
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      <Input
        className="h-8 text-xs"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function PitchResultsTable({ data }: { data: SearchPitch[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left py-2 px-2 font-medium">Date</th>
            <th className="text-left py-2 px-2 font-medium">Pitcher</th>
            <th className="text-left py-2 px-2 font-medium">Batter</th>
            <th className="text-left py-2 px-2 font-medium">Pitch</th>
            <th className="text-right py-2 px-2 font-medium">Velo</th>
            <th className="text-left py-2 px-2 font-medium">Count</th>
            <th className="text-left py-2 px-2 font-medium">Result</th>
            <th className="text-right py-2 px-2 font-medium">EV</th>
            <th className="text-right py-2 px-2 font-medium">LA</th>
            <th className="text-right py-2 px-2 font-medium">Dist</th>
            <th className="text-left py-2 px-2 font-medium">Event</th>
            <th className="text-right py-2 px-2 font-medium">xBA</th>
            <th className="text-right py-2 px-2 font-medium">xwOBA</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-1.5 px-2 tabular-nums">{p.game_date}</td>
              <td className="py-1.5 px-2">
                <span className="text-muted-foreground text-[10px] mr-1">{p.pitcher_team}</span>
                {p.pitcher_name}
              </td>
              <td className="py-1.5 px-2">
                <span className="text-muted-foreground text-[10px] mr-1">{p.batter_team}</span>
                {p.batter_name}
              </td>
              <td className="py-1.5 px-2">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: pitchColor(p.pitch_type ?? "") }}
                />
                {p.pitch_name ?? p.pitch_type}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {p.release_speed?.toFixed(1) ?? ""}
              </td>
              <td className="py-1.5 px-2 tabular-nums">{p.balls}-{p.strikes}</td>
              <td className="py-1.5 px-2 text-muted-foreground">
                {(p.description ?? "").replace(/_/g, " ")}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {p.launch_speed?.toFixed(1) ?? ""}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {p.launch_angle?.toFixed(0) ?? ""}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {p.hit_distance?.toFixed(0) ?? ""}
              </td>
              <td className="py-1.5 px-2 font-medium">
                {p.events ? p.events.replace(/_/g, " ") : ""}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {p.estimated_ba?.toFixed(3).replace(/^0/, "") ?? ""}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {p.estimated_woba?.toFixed(3).replace(/^0/, "") ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AggResultsTable({ data, groupBy }: { data: SearchAggRow[]; groupBy: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left py-2 px-2 font-medium">
              {groupBy === "pitcher" ? "Pitcher" : "Batter"}
            </th>
            <th className="text-right py-2 px-2 font-medium">Pitches</th>
            <th className="text-right py-2 px-2 font-medium">Avg Velo</th>
            <th className="text-right py-2 px-2 font-medium">Max Velo</th>
            <th className="text-right py-2 px-2 font-medium">Avg EV</th>
            <th className="text-right py-2 px-2 font-medium">Avg LA</th>
            <th className="text-right py-2 px-2 font-medium">Barrel%</th>
            <th className="text-right py-2 px-2 font-medium">HardHit%</th>
            <th className="text-right py-2 px-2 font-medium">Whiff%</th>
            <th className="text-right py-2 px-2 font-medium">Avg Spin</th>
            <th className="text-right py-2 px-2 font-medium">xBA</th>
            <th className="text-right py-2 px-2 font-medium">xwOBA</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.player_id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-1.5 px-2">
                <Link
                  to={`/players/${r.player_id}`}
                  className="text-primary hover:underline underline-offset-2"
                >
                  {r.name}
                </Link>
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">{r.pitches}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{r.avg_velo?.toFixed(1) ?? ""}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{r.max_velo?.toFixed(1) ?? ""}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{r.avg_launch_speed?.toFixed(1) ?? ""}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{r.avg_launch_angle?.toFixed(1) ?? ""}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{r.barrel_pct?.toFixed(1) ?? ""}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{r.hard_hit_pct?.toFixed(1) ?? ""}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{r.whiff_pct?.toFixed(1) ?? ""}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{r.avg_spin ? Math.round(r.avg_spin) : ""}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{r.xba?.toFixed(3).replace(/^0/, "") ?? ""}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{r.xwoba?.toFixed(3).replace(/^0/, "") ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StatcastSearch() {
  const [mode, setMode] = useState<"pitches" | "aggregated">("pitches");
  const [groupBy, setGroupBy] = useState("batter");
  const [submitted, setSubmitted] = useState(false);

  const [filters, setFilters] = useState<SearchFilters>({
    season: DEFAULT_SEASON,
  });

  const updateFilter = useCallback(
    (key: keyof SearchFilters, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setSubmitted(false);
    },
    [],
  );

  const pitchQuery = useSearchPitches(filters, submitted && mode === "pitches");
  const aggQuery = useSearchAggregate(
    { ...filters, group_by: groupBy, min_pitches: "50" },
    submitted && mode === "aggregated",
  );

  const isLoading = mode === "pitches" ? pitchQuery.isLoading : aggQuery.isLoading;
  const isError = mode === "pitches" ? pitchQuery.isError : aggQuery.isError;
  const result = mode === "pitches" ? pitchQuery.data : aggQuery.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1>
          Statcast Search
        </h1>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Season</label>
          <Select
            value={String(filters.season)}
            onValueChange={(v) => updateFilter("season", v)}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEASONS.map((s) => (
                <SelectItem key={s} value={String(s)}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Row 1: Pitch & Result filters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <FilterSelect
              label="Pitch Type"
              value={filters.pitch_type ?? "all"}
              onValueChange={(v) => updateFilter("pitch_type", v)}
              options={PITCH_TYPES}
            />
            <FilterSelect
              label="PA Result"
              value={filters.events ?? "all"}
              onValueChange={(v) => updateFilter("events", v)}
              options={EVENTS}
            />
            <FilterSelect
              label="Batted Ball"
              value={filters.bb_type ?? "all"}
              onValueChange={(v) => updateFilter("bb_type", v)}
              options={BB_TYPES}
            />
            <FilterSelect
              label="Batter Hand"
              value={filters.stand ?? "all"}
              onValueChange={(v) => updateFilter("stand", v)}
              options={[
                { value: "all", label: "Both" },
                { value: "L", label: "Left" },
                { value: "R", label: "Right" },
              ]}
            />
            <FilterSelect
              label="Pitcher Hand"
              value={filters.p_throws ?? "all"}
              onValueChange={(v) => updateFilter("p_throws", v)}
              options={[
                { value: "all", label: "Both" },
                { value: "L", label: "Left" },
                { value: "R", label: "Right" },
              ]}
            />
          </div>

          {/* Row 2: Count, teams */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <FilterSelect
              label="Balls"
              value={filters.balls ?? "all"}
              onValueChange={(v) => updateFilter("balls", v)}
              options={COUNTS}
            />
            <FilterSelect
              label="Strikes"
              value={filters.strikes ?? "all"}
              onValueChange={(v) => updateFilter("strikes", v)}
              options={STRIKES_OPTIONS}
            />
            <FilterSelect
              label="Batter Team"
              value={filters.batter_team ?? "all"}
              onValueChange={(v) => updateFilter("batter_team", v)}
              options={[{ value: "all", label: "All Teams" }, ...TEAMS.map((t) => ({ value: t, label: t }))]}
            />
            <FilterSelect
              label="Pitcher Team"
              value={filters.pitcher_team ?? "all"}
              onValueChange={(v) => updateFilter("pitcher_team", v)}
              options={[{ value: "all", label: "All Teams" }, ...TEAMS.map((t) => ({ value: t, label: t }))]}
            />
            <FilterSelect
              label="Barrel Only"
              value={filters.barrel ?? "all"}
              onValueChange={(v) => updateFilter("barrel", v)}
              options={[
                { value: "all", label: "All" },
                { value: "true", label: "Barrels Only" },
              ]}
            />
          </div>

          {/* Row 3: Numeric ranges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <FilterInput
              label="Min Velo"
              value={filters.min_velo ?? ""}
              onChange={(v) => updateFilter("min_velo", v)}
              placeholder="e.g. 95"
              type="number"
            />
            <FilterInput
              label="Max Velo"
              value={filters.max_velo ?? ""}
              onChange={(v) => updateFilter("max_velo", v)}
              placeholder="e.g. 100"
              type="number"
            />
            <FilterInput
              label="Min Exit Velo"
              value={filters.min_ev ?? ""}
              onChange={(v) => updateFilter("min_ev", v)}
              placeholder="e.g. 100"
              type="number"
            />
            <FilterInput
              label="Max Exit Velo"
              value={filters.max_ev ?? ""}
              onChange={(v) => updateFilter("max_ev", v)}
              placeholder="e.g. 115"
              type="number"
            />
            <FilterInput
              label="Min Launch Angle"
              value={filters.min_la ?? ""}
              onChange={(v) => updateFilter("min_la", v)}
              placeholder="e.g. 25"
              type="number"
            />
            <FilterInput
              label="Max Launch Angle"
              value={filters.max_la ?? ""}
              onChange={(v) => updateFilter("max_la", v)}
              placeholder="e.g. 35"
              type="number"
            />
          </div>

          {/* Search controls */}
          <div className="flex items-center gap-3 pt-2">
            <Tabs value={mode} onValueChange={(v) => { setMode(v as "pitches" | "aggregated"); setSubmitted(false); }}>
              <TabsList>
                <TabsTrigger value="pitches">Pitch-Level</TabsTrigger>
                <TabsTrigger value="aggregated">Aggregated</TabsTrigger>
              </TabsList>
            </Tabs>
            {mode === "aggregated" && (
              <FilterSelect
                label=""
                value={groupBy}
                onValueChange={setGroupBy}
                options={[
                  { value: "batter", label: "Group by Batter" },
                  { value: "pitcher", label: "Group by Pitcher" },
                ]}
                className="w-44"
              />
            )}
            <div className="flex-1" />
            <Button onClick={() => setSubmitted(true)} size="sm">
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {submitted && (
        <Card>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Searching...
              </div>
            ) : isError ? (
              <div className="py-4">
                <QueryError
                  message="Search failed. Try adjusting your filters."
                  onRetry={() => setSubmitted(true)}
                />
              </div>
            ) : result ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {result.total.toLocaleString()} {mode === "pitches" ? "pitches" : "players"} found
                  {mode === "pitches" && result.total >= 500 && " (showing first 500)"}
                </p>
                {mode === "pitches" && result.pitches?.length ? (
                  <PitchResultsTable data={result.pitches} />
                ) : mode === "aggregated" && result.aggregated?.length ? (
                  <AggResultsTable data={result.aggregated} groupBy={groupBy} />
                ) : (
                  <p className="text-muted-foreground py-8 text-center">
                    No results match your filters.
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
