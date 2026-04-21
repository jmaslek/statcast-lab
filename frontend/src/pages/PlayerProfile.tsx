import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/QueryError";
import PlayerHeader from "@/components/PlayerHeader";
import StatTabs from "@/components/StatTabs";
import { usePlayer, usePlayerStats } from "@/hooks/use-player";
import { SEASONS, DEFAULT_SEASON } from "@/lib/constants";

export default function PlayerProfile() {
  const { playerId: playerIdParam } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const playerId = playerIdParam ? Number(playerIdParam) : undefined;
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const seasonId = "player-season";

  const playerQuery = usePlayer(playerId);
  const statsQuery = usePlayerStats(playerId, season);

  if (playerId == null) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Players</h1>
        <p className="text-muted-foreground">
          Search for a player or pick one from{" "}
          <Link
            to="/"
            className="text-primary underline-offset-4 hover:underline"
          >
            Explore
          </Link>
          .
        </p>
      </div>
    );
  }

  if (playerQuery.isError) {
    return (
      <QueryError
        message="Failed to load player data."
        onRetry={() => playerQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Season Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            to="/"
            className="text-primary underline-offset-4 hover:underline"
          >
            Explore
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
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/compare?players=${playerId}`)}
          >
            Compare with...
          </Button>
          <div className="flex items-center gap-2">
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
