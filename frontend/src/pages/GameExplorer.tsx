import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/QueryError";
import { Boxscore } from "@/components/Boxscore";
import { useGameList, useGameDetail, useBoxscore } from "@/hooks/use-games";
import type { GameSummary } from "@/hooks/use-games";

function parseGameDate(dateStr: string): Date | null {
  if (!dateStr) {
    return null;
  }
  const parsed = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function shiftDate(dateStr: string, days: number): string {
  const d = parseGameDate(dateStr);
  if (!d) {
    return "";
  }
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string): string {
  const d = parseGameDate(dateStr);
  if (!d) {
    return "Loading date...";
  }
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---- Scoreboard row ----

function ScoreboardRow({
  game,
  isSelected,
  onClick,
}: {
  game: GameSummary;
  isSelected: boolean;
  onClick: () => void;
}) {
  const hasScore = game.home_score !== null && game.away_score !== null;
  const awayWins = hasScore && game.away_score! > game.home_score!;
  const homeWins = hasScore && game.home_score! > game.away_score!;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm ${
        isSelected
          ? "bg-primary/10 ring-1 ring-primary/30"
          : "hover:bg-muted/60"
      }`}
      aria-pressed={isSelected}
    >
      <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`truncate ${awayWins ? "font-bold" : "font-medium"}`}
            >
              {game.away_team}
            </span>
            {hasScore && (
              <span
                className={`tabular-nums ${
                  awayWins ? "font-bold" : "text-muted-foreground"
                }`}
              >
                {game.away_score}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span
              className={`truncate ${homeWins ? "font-bold" : "font-medium"}`}
            >
              {game.home_team}
            </span>
            {hasScore && (
              <span
                className={`tabular-nums ${
                  homeWins ? "font-bold" : "text-muted-foreground"
                }`}
              >
                {game.home_score}
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {hasScore ? "Final" : "—"}
        </div>
      </div>
    </button>
  );
}

function ScoreboardSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-md" />
      ))}
    </div>
  );
}

// ---- Main page ----

export default function GameExplorer() {
  const { gamePk: gamePkParam } = useParams<{ gamePk: string }>();
  const navigate = useNavigate();

  // Start with empty date — backend returns the most recent date with data
  const [dateInput, setDateInput] = useState("");
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(
    gamePkParam ? Number(gamePkParam) : null,
  );

  useEffect(() => {
    if (gamePkParam) setSelectedGamePk(Number(gamePkParam));
  }, [gamePkParam]);

  const {
    data: gameList,
    isLoading: isListLoading,
    isError: isListError,
  } = useGameList(dateInput);

  const { data: gameDetail, isLoading: isDetailLoading } =
    useGameDetail(selectedGamePk);

  const { data: boxscore, isLoading: isBoxscoreLoading } =
    useBoxscore(selectedGamePk);

  useEffect(() => {
    if (gameList?.date && gameList.date !== dateInput) {
      setDateInput(gameList.date);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameList?.date]);

  // Auto-select first game
  useEffect(() => {
    if (!selectedGamePk && gameList?.games.length && !gamePkParam) {
      const first = gameList.games[0];
      setSelectedGamePk(first.game_pk);
      navigate(`/games/${first.game_pk}`, { replace: true });
    }
  }, [gameList, selectedGamePk, gamePkParam, navigate]);

  function handleGameClick(gamePk: number) {
    setSelectedGamePk(gamePk);
    navigate(`/games/${gamePk}`, { replace: true });
  }

  function handleDateChange(newDate: string) {
    setDateInput(newDate);
    setSelectedGamePk(null);
    navigate("/games", { replace: true });
  }

  const dateId = "game-date";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Game Explorer</h1>

      {/* Date navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="px-2"
          onClick={() => handleDateChange(shiftDate(dateInput, -1))}
          disabled={!dateInput}
          aria-label="Previous day"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div>
          <label htmlFor={dateId} className="sr-only">
            Game date
          </label>
          <Input
            id={dateId}
            type="date"
            value={dateInput}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-40 text-center"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="px-2"
          onClick={() => handleDateChange(shiftDate(dateInput, 1))}
          disabled={!dateInput}
          aria-label="Next day"
        >
          <ChevronRight className="size-4" />
        </Button>
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {formatDateLabel(dateInput)}
        </span>
      </div>

      {/* Two-panel layout: scoreboard left, detail right */}
      <div className="flex flex-col lg:flex-row gap-4 min-h-0">
        {/* Scoreboard panel */}
        <aside className="lg:w-56 xl:w-64 shrink-0">
          <div className="lg:sticky lg:top-6">
            {isListLoading ? (
              <ScoreboardSkeleton />
            ) : isListError ? (
              <QueryError message="Failed to load games." />
            ) : gameList && gameList.games.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No games on {formatDateLabel(gameList.date)}.
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground pb-1">
                  {gameList?.games.length} game
                  {gameList?.games.length !== 1 ? "s" : ""}
                </p>
                {gameList?.games.map((game) => (
                  <ScoreboardRow
                    key={game.game_pk}
                    game={game}
                    isSelected={selectedGamePk === game.game_pk}
                    onClick={() => handleGameClick(game.game_pk)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Detail panel */}
        <section className="flex-1 min-w-0">
          {selectedGamePk === null ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground border rounded-lg border-dashed">
              Select a game to view details
            </div>
          ) : (
            <Boxscore
              boxscore={boxscore}
              gameDetail={gameDetail}
              isLoading={isBoxscoreLoading || isDetailLoading}
            />
          )}
        </section>
      </div>
    </div>
  );
}
