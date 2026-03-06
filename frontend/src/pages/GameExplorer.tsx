import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { GameCard } from "@/components/GameCard";
import { PitchByPitch } from "@/components/PitchByPitch";
import { useGameList, useGameDetail } from "@/hooks/use-games";

export default function GameExplorer() {
  const { gamePk: gamePkParam } = useParams<{ gamePk: string }>();
  const navigate = useNavigate();

  // Default to a recent date (2024-09-29 is the last day of 2024 regular season)
  const [dateInput, setDateInput] = useState("2024-09-29");
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(
    gamePkParam ? Number(gamePkParam) : null
  );

  // Sync URL param to state
  useEffect(() => {
    if (gamePkParam) {
      setSelectedGamePk(Number(gamePkParam));
    }
  }, [gamePkParam]);

  const {
    data: gameList,
    isLoading: isListLoading,
    isError: isListError,
    error: listError,
  } = useGameList(dateInput);

  const {
    data: gameDetail,
    isLoading: isDetailLoading,
  } = useGameDetail(selectedGamePk);

  // Update date when API returns the actual date (for default case)
  useEffect(() => {
    if (gameList?.date && gameList.date !== dateInput) {
      setDateInput(gameList.date);
    }
    // Only run when gameList changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameList?.date]);

  function handleGameClick(gamePk: number) {
    setSelectedGamePk(gamePk);
    navigate(`/games/${gamePk}`, { replace: true });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Game Explorer</h1>

      {/* Date picker */}
      <div className="space-y-1 max-w-xs">
        <label className="text-sm font-medium">Game Date</label>
        <Input
          type="date"
          value={dateInput}
          onChange={(e) => {
            setDateInput(e.target.value);
            setSelectedGamePk(null);
            navigate("/games", { replace: true });
          }}
        />
      </div>

      {/* Game list */}
      {isListLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : isListError ? (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
          Failed to load games.{" "}
          {listError instanceof Error ? listError.message : ""}
        </div>
      ) : gameList && gameList.games.length === 0 ? (
        <div className="rounded-md border p-6 text-center text-muted-foreground">
          No games found for {dateInput}. Try a different date.
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {gameList?.games.length} game{gameList?.games.length !== 1 ? "s" : ""}{" "}
            on {gameList?.date}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {gameList?.games.map((game) => (
              <GameCard
                key={game.game_pk}
                game={game}
                isSelected={selectedGamePk === game.game_pk}
                onClick={() => handleGameClick(game.game_pk)}
              />
            ))}
          </div>
        </>
      )}

      {/* Pitch-by-pitch detail */}
      {selectedGamePk !== null && (
        <PitchByPitch game={gameDetail} isLoading={isDetailLoading} />
      )}
    </div>
  );
}
