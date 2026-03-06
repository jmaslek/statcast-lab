import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PlayerPicker from "@/components/PlayerPicker";
import type { SelectedPlayer } from "@/components/PlayerPicker";
import ComparisonTable from "@/components/ComparisonTable";
import { useCompare } from "@/hooks/use-compare";

const SEASONS = Array.from({ length: 11 }, (_, i) => 2025 - i); // 2025..2015 (newest first)

export default function Compare() {
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
  const [season, setSeason] = useState(2025);

  const playerIds = selectedPlayers.map((p) => p.player_id);
  const compareQuery = useCompare(playerIds, season);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Player Comparison</h1>
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

      {/* Player picker */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <h2 className="text-sm font-medium">
              Select 2-3 players to compare
            </h2>
            <PlayerPicker
              selected={selectedPlayers}
              onChange={setSelectedPlayers}
              maxPlayers={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* States */}
      {playerIds.length < 2 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              Select at least 2 players to see a comparison.
            </p>
          </CardContent>
        </Card>
      )}

      {compareQuery.isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {compareQuery.isError && (
        <Card>
          <CardContent className="pt-6">
            <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
              Failed to load comparison data.{" "}
              {compareQuery.error instanceof Error
                ? compareQuery.error.message
                : ""}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison table */}
      {compareQuery.data && compareQuery.data.players.length > 0 && (
        <ComparisonTable players={compareQuery.data.players} />
      )}

      {compareQuery.data && compareQuery.data.players.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              No data available for the selected players in {season}.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
