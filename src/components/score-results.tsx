"use client";

import { Crown, RotateCcw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ExpeditionScoreRow } from "./expedition-score-row";
import { cn } from "@/lib/utils";
import type { GameResult } from "@/lib/types";

interface ScoreResultsProps {
  result: GameResult;
  onReset: () => void;
  onEditCards: () => void;
}

function PlayerCard({
  name,
  expeditions,
  totalScore,
  isWinner,
}: {
  name: string;
  expeditions: GameResult["player1"]["expeditions"];
  totalScore: number;
  isWinner: boolean;
}) {
  return (
    <Card
      className={cn(
        "w-full transition-all",
        isWinner && "ring-2 ring-amber-500/50"
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isWinner && <Crown className="w-5 h-5 text-amber-400" />}
            <span className="text-base">{name}</span>
          </div>
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              totalScore > 0
                ? "text-green-400"
                : totalScore < 0
                  ? "text-red-400"
                  : "text-muted-foreground"
            )}
          >
            {totalScore > 0 ? `+${totalScore}` : totalScore}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Separator className="mb-3" />
        <div className="flex flex-col gap-1">
          {expeditions.map((expScore) => (
            <ExpeditionScoreRow
              key={expScore.expedition.color}
              expeditionScore={expScore}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ScoreResults({
  result,
  onReset,
  onEditCards,
}: ScoreResultsProps) {
  const { player1, player2, winner } = result;
  const isTie = winner === null;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Winner banner */}
      <div
        className={cn(
          "text-center py-4 px-6 rounded-2xl",
          isTie
            ? "bg-muted"
            : "bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/20"
        )}
      >
        {isTie ? (
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">🤝</span>
            <span className="text-lg font-bold">It&apos;s a tie!</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            <span className="text-lg font-bold">{winner} wins!</span>
            <Trophy className="w-6 h-6 text-amber-400" />
          </div>
        )}
        <p className="text-sm text-muted-foreground mt-1">
          {player1.totalScore} vs {player2.totalScore}
          {!isTie &&
            ` (by ${Math.abs(player1.totalScore - player2.totalScore)} points)`}
        </p>
      </div>

      {/* Player cards */}
      <PlayerCard
        name={player1.name}
        expeditions={player1.expeditions}
        totalScore={player1.totalScore}
        isWinner={winner === player1.name}
      />
      <PlayerCard
        name={player2.name}
        expeditions={player2.expeditions}
        totalScore={player2.totalScore}
        isWinner={winner === player2.name}
      />

      {/* Action buttons */}
      <div className="flex gap-3 mt-2">
        <Button
          size="lg"
          variant="outline"
          className="flex-1 h-14 text-base gap-2"
          onClick={onEditCards}
        >
          Edit Cards
        </Button>
        <Button
          size="lg"
          className="flex-1 h-14 text-base gap-2"
          onClick={onReset}
        >
          <RotateCcw className="w-5 h-5" />
          New Game
        </Button>
      </div>
    </div>
  );
}
