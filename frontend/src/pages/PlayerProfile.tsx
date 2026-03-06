import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import PlayerHeader from "@/components/PlayerHeader";
import StatTabs from "@/components/StatTabs";
import { usePlayer, usePlayerStats } from "@/hooks/use-player";

const SEASONS = Array.from({ length: 11 }, (_, i) => 2015 + i); // 2015..2025

export default function PlayerProfile() {
  const { playerId: playerIdParam } = useParams<{ playerId: string }>();
  const playerId = playerIdParam ? Number(playerIdParam) : undefined;
  const [season, setSeason] = useState(2024);

  const playerQuery = usePlayer(playerId);
  const statsQuery = usePlayerStats(playerId, season);

  if (playerId == null) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Players</h1>
        <p className="text-muted-foreground">
          Search for a player or select one from the{" "}
          <Link
            to="/leaderboard"
            className="text-primary underline-offset-4 hover:underline"
          >
            leaderboards
          </Link>
          .
        </p>
      </div>
    );
  }

  if (playerQuery.isError) {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
        Failed to load player.{" "}
        {playerQuery.error instanceof Error ? playerQuery.error.message : ""}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Season Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            to="/players"
            className="text-primary underline-offset-4 hover:underline"
          >
            Players
          </Link>
          <span>/</span>
          {playerQuery.isLoading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <span className="text-foreground font-medium">
              {playerQuery.data?.name_full}
            </span>
          )}
        </div>
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

      {/* Player Header */}
      <PlayerHeader
        player={playerQuery.data}
        stats={statsQuery.data}
        isLoading={playerQuery.isLoading || statsQuery.isLoading}
      />

      {/* Stat Tabs */}
      <StatTabs
        stats={statsQuery.data}
        isLoading={statsQuery.isLoading}
        playerId={playerId}
        season={season}
      />
    </div>
  );
}
