import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDashboardHittingLeaders,
  useDashboardPitchingLeaders,
} from "@/hooks/use-dashboard";

// ---- Types ----

interface PlayerSearchResult {
  results: {
    player_id: number;
    name_full: string;
    position: string;
    team: string;
  }[];
  total: number;
}

// ---- Constants ----

const SEASONS = Array.from({ length: 11 }, (_, i) => 2025 - i); // 2025..2015 (newest first)

// ---- Formatting helpers ----

function fmtAvg(val: number): string {
  return val.toFixed(3).replace(/^0/, "");
}

function fmtPct(val: number): string {
  return `${val.toFixed(1)}%`;
}

function fmtDec1(val: number): string {
  return val.toFixed(1);
}

// ---- Quick Search component ----

function QuickSearch() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const searchQuery = useQuery({
    queryKey: ["player-search", debouncedSearch],
    queryFn: () =>
      fetchApi<PlayerSearchResult>("/players/search", {
        q: debouncedSearch,
        limit: "10",
      }),
    enabled: debouncedSearch.length >= 2,
  });

  const results = searchQuery.data?.results ?? [];

  return (
    <Card>
      <CardContent className="pt-0">
        <Command shouldFilter={false} className="rounded-lg border">
          <CommandInput
            placeholder="Search for a player..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {debouncedSearch.length < 2 ? (
              <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
            ) : searchQuery.isLoading ? (
              <CommandEmpty>Searching...</CommandEmpty>
            ) : results.length === 0 ? (
              <CommandEmpty>No players found.</CommandEmpty>
            ) : (
              <CommandGroup heading="Players">
                {results.map((player) => (
                  <CommandItem
                    key={player.player_id}
                    value={String(player.player_id)}
                    onSelect={() => {
                      navigate(`/players/${player.player_id}`);
                      setSearch("");
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{player.name_full}</span>
                      <span className="text-xs text-muted-foreground">
                        {player.position} - {player.team}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CardContent>
    </Card>
  );
}

// ---- Skeleton for leaderboard tables ----

function LeaderboardSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-full" />
      ))}
    </div>
  );
}

// ---- Main Dashboard component ----

export default function Dashboard() {
  const [season, setSeason] = useState(2025);

  const hitting = useDashboardHittingLeaders(season);
  const pitching = useDashboardPitchingLeaders(season);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Season</label>
          <Select
            value={String(season)}
            onValueChange={(v) => setSeason(Number(v))}
          >
            <SelectTrigger className="w-28">
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

      {/* Quick search */}
      <QuickSearch />

      {/* Leaderboard snapshot cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Hitters by OPS */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Top Hitters by OPS</CardTitle>
              <Link
                to="/leaderboard"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                See All
              </Link>
            </div>
            <CardDescription>
              Top 5 hitters with min 100 PA in {season}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hitting.isLoading ? (
              <LeaderboardSkeleton />
            ) : hitting.isError ? (
              <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                Failed to load hitting leaders.{" "}
                {hitting.error instanceof Error ? hitting.error.message : ""}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">OPS</TableHead>
                    <TableHead className="text-right">AVG</TableHead>
                    <TableHead className="text-right">HR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(hitting.data?.players ?? []).map((player, idx) => (
                    <TableRow key={player.player_id}>
                      <TableCell className="text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/players/${player.player_id}`}
                          className="text-primary underline-offset-4 hover:underline font-medium"
                        >
                          {player.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmtAvg(player.ops)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmtAvg(player.avg)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {player.home_runs}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top Pitchers by K% */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Top Pitchers by K%</CardTitle>
              <Link
                to="/leaderboard"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                See All
              </Link>
            </div>
            <CardDescription>
              Top 5 pitchers with min 200 pitches in {season}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pitching.isLoading ? (
              <LeaderboardSkeleton />
            ) : pitching.isError ? (
              <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                Failed to load pitching leaders.{" "}
                {pitching.error instanceof Error
                  ? pitching.error.message
                  : ""}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">K%</TableHead>
                    <TableHead className="text-right">Whiff%</TableHead>
                    <TableHead className="text-right">Velo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pitching.data?.players ?? []).map((player, idx) => (
                    <TableRow key={player.player_id}>
                      <TableCell className="text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/players/${player.player_id}`}
                          className="text-primary underline-offset-4 hover:underline font-medium"
                        >
                          {player.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmtPct(player.k_pct)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmtPct(player.whiff_pct)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmtDec1(player.avg_velo)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link to="/leaderboard" className="block">
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">Leaderboards</CardTitle>
                <CardDescription>
                  Browse full hitting and pitching leaderboards with sorting and
                  filters.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/compare" className="block">
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">Compare Players</CardTitle>
                <CardDescription>
                  Side-by-side player analysis with stats and visualizations.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/games" className="block">
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">Game Explorer</CardTitle>
                <CardDescription>
                  Pitch-by-pitch game data with detailed play breakdowns.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
