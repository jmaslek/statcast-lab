import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import PlayerPicker from "@/components/PlayerPicker";
import type { SelectedPlayer } from "@/components/PlayerPicker";
import ComparisonTable from "@/components/ComparisonTable";
import ArsenalComparisonPlot from "@/components/d3/ArsenalComparisonPlot";
import { QueryError } from "@/components/QueryError";
import { useCompare } from "@/hooks/use-compare";
import { useArsenalComparison } from "@/hooks/use-player";
import { SEASONS, DEFAULT_SEASON } from "@/lib/constants";

export default function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const seasonId = "compare-season";

  // Pre-populate from URL query params (?players=123,456)
  useEffect(() => {
    const playersParam = searchParams.get("players");
    if (playersParam && selectedPlayers.length === 0) {
      const ids = playersParam.split(",").map(Number).filter(Boolean);
      if (ids.length > 0) {
        // Create placeholder entries -- names will resolve when data loads
        setSelectedPlayers(
          ids.map((id) => ({
            player_id: id,
            name: `Player ${id}`,
            position: "",
            team: "",
          })),
        );
      }
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync URL when players change
  useEffect(() => {
    if (selectedPlayers.length > 0) {
      setSearchParams(
        { players: selectedPlayers.map((p) => p.player_id).join(",") },
        { replace: true },
      );
    }
  }, [selectedPlayers, setSearchParams]);

  const playerIds = selectedPlayers.map((p) => p.player_id);
  const compareQuery = useCompare(playerIds, season);
  const arsenalQuery = useArsenalComparison(playerIds, season);

  // Update player names from comparison data when available
  useEffect(() => {
    if (!compareQuery.data?.players) return;
    setSelectedPlayers((prev) => {
      const needsUpdate = prev.some((p) => {
        const match = compareQuery.data!.players.find((cp) => cp.player_id === p.player_id);
        return match && match.name !== p.name;
      });
      if (!needsUpdate) return prev;
      return prev.map((p) => {
        const match = compareQuery.data!.players.find((cp) => cp.player_id === p.player_id);
        return match ? { ...p, name: match.name } : p;
      });
    });
  }, [compareQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Compare Players</h1>
        <div className="flex items-center gap-2">
          <label htmlFor={seasonId} className="text-sm font-medium">Season</label>
          <Select value={String(season)} onValueChange={(v) => setSeason(Number(v))}>
            <SelectTrigger id={seasonId} className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEASONS.map((s) => (<SelectItem key={s} value={String(s)}>{s}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Player picker */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Select 2-3 players to compare</p>
        <PlayerPicker
          selected={selectedPlayers}
          onChange={setSelectedPlayers}
          maxPlayers={3}
        />
      </div>

      {playerIds.length < 2 ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground border rounded-lg border-dashed">
          Select at least 2 players to see a comparison
        </div>
      ) : (
        <Tabs defaultValue="stats">
          <TabsList>
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="arsenal">Arsenal</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="pt-4">
            {compareQuery.isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : compareQuery.isError ? (
              <QueryError message="Failed to load comparison data." onRetry={() => compareQuery.refetch()} />
            ) : compareQuery.data && compareQuery.data.players.length > 0 ? (
              <ComparisonTable players={compareQuery.data.players} />
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No data available for the selected players in {season}.
              </p>
            )}
          </TabsContent>

          <TabsContent value="arsenal" className="pt-4">
            {arsenalQuery.isLoading ? (
              <Skeleton className="h-[500px] w-full" />
            ) : arsenalQuery.isError ? (
              <QueryError message="Failed to load arsenal comparison." onRetry={() => arsenalQuery.refetch()} />
            ) : arsenalQuery.data?.pitchers.length ? (
              <div className="flex justify-center">
                <ArsenalComparisonPlot
                  pitchers={arsenalQuery.data.pitchers}
                  leagueAverages={arsenalQuery.data.league_averages}
                />
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No arsenal data found. Arsenal comparison requires pitchers.
              </p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
