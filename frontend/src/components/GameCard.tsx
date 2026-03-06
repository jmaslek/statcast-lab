import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GameSummary } from "@/hooks/use-games";

interface GameCardProps {
  game: GameSummary;
  isSelected: boolean;
  onClick: () => void;
}

export function GameCard({ game, isSelected, onClick }: GameCardProps) {
  const hasScore = game.home_score !== null && game.away_score !== null;

  return (
    <Card
      className={`cursor-pointer transition-colors hover:border-primary/50 ${
        isSelected ? "border-primary ring-2 ring-primary/20" : ""
      }`}
      onClick={onClick}
    >
      <CardHeader>
        <CardTitle className="text-base">
          {game.away_team} @ {game.home_team}
        </CardTitle>
        <CardDescription>{game.game_date}</CardDescription>
      </CardHeader>
      <CardContent>
        {hasScore ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{game.away_team}</span>
              <Badge
                variant={
                  game.away_score! > game.home_score!
                    ? "default"
                    : "secondary"
                }
              >
                {game.away_score}
              </Badge>
            </div>
            <span className="text-muted-foreground text-xs">-</span>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  game.home_score! > game.away_score!
                    ? "default"
                    : "secondary"
                }
              >
                {game.home_score}
              </Badge>
              <span className="text-sm font-medium">{game.home_team}</span>
            </div>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">No score data</span>
        )}
      </CardContent>
    </Card>
  );
}
