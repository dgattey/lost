"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  Crown,
  Pencil,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
import { useGame } from "@/lib/game-context";
import { EXPEDITION_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { RoundData } from "@/lib/types";

function RoundCard({ round }: { round: RoundData }) {
  const { player1, player2 } = round.result;
  const isP1Winner = player1.totalScore > player2.totalScore;
  const isP2Winner = player2.totalScore > player1.totalScore;
  const isTie = player1.totalScore === player2.totalScore;

  const activeExpeditions = round.player1Expeditions.filter(
    (e) => e.wagerCount > 0 || e.cardValues.length > 0
  );
  const activeExpeditions2 = round.player2Expeditions.filter(
    (e) => e.wagerCount > 0 || e.cardValues.length > 0
  );

  return (
    <Link href={`/round/${round.roundNumber}`}>
      <Card className="w-full transition-all hover:bg-accent/50 active:scale-[0.98]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">
                Round {round.roundNumber}
              </span>
              {round.swapped && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
                  Swapped
                </span>
              )}
              {round.inputMethod === "photo" && (
                <Camera className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(round.timestamp).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                {isP1Winner && (
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span className="text-sm font-medium">Player 1</span>
              </div>
              <span
                className={cn(
                  "text-lg font-bold tabular-nums",
                  isP1Winner
                    ? "text-green-400"
                    : isP2Winner
                      ? "text-red-400"
                      : "text-muted-foreground"
                )}
              >
                {player1.totalScore > 0
                  ? `+${player1.totalScore}`
                  : player1.totalScore}
              </span>
            </div>

            <div className="text-center px-3">
              {isTie ? (
                <span className="text-xs text-muted-foreground">Tie</span>
              ) : (
                <span className="text-xs text-muted-foreground">vs</span>
              )}
            </div>

            <div className="flex-1 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-sm font-medium">Player 2</span>
                {isP2Winner && (
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                )}
              </div>
              <span
                className={cn(
                  "text-lg font-bold tabular-nums",
                  isP2Winner
                    ? "text-green-400"
                    : isP1Winner
                      ? "text-red-400"
                      : "text-muted-foreground"
                )}
              >
                {player2.totalScore > 0
                  ? `+${player2.totalScore}`
                  : player2.totalScore}
              </span>
            </div>
          </div>

          {/* Expedition color dots */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
            <div className="flex gap-1">
              {activeExpeditions.map((e) => (
                <div
                  key={e.color}
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: EXPEDITION_CONFIG[e.color].hex,
                  }}
                />
              ))}
              {activeExpeditions.length === 0 && (
                <span className="text-[10px] text-muted-foreground">
                  No expeditions
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {activeExpeditions2.map((e) => (
                <div
                  key={e.color}
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: EXPEDITION_CONFIG[e.color].hex,
                  }}
                />
              ))}
              {activeExpeditions2.length === 0 && (
                <span className="text-[10px] text-muted-foreground">
                  No expeditions
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ hero }: { hero: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-6 pt-4">{hero}</div>
  );
}

function GameDashboard() {
  const { rounds, totalScores, overallWinner, startNewGame } = useGame();
  const router = useRouter();

  const isP1Leading = totalScores.player1 > totalScores.player2;
  const isP2Leading = totalScores.player2 > totalScores.player1;

  return (
    <div className="flex flex-col gap-5">
      {/* Total Score Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-card to-card/80 border border-border p-5">
        <div className="text-center mb-4">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Game Total — {rounds.length}{" "}
            {rounds.length === 1 ? "Round" : "Rounds"}
          </span>
        </div>
        <div className="flex items-end justify-center gap-6">
          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              {isP1Leading && (
                <Trophy className="w-4 h-4 text-amber-400" />
              )}
              <span className="text-sm font-medium text-muted-foreground">
                Player 1
              </span>
            </div>
            <span
              className={cn(
                "text-3xl font-bold tabular-nums",
                isP1Leading
                  ? "text-green-400"
                  : isP2Leading
                    ? "text-red-400"
                    : "text-foreground"
              )}
            >
              {totalScores.player1}
            </span>
          </div>

          <div className="text-center pb-1">
            {overallWinner ? (
              <span className="text-xs text-muted-foreground">
                Lead:{" "}
                {Math.abs(totalScores.player1 - totalScores.player2)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Tied</span>
            )}
          </div>

          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="text-sm font-medium text-muted-foreground">
                Player 2
              </span>
              {isP2Leading && (
                <Trophy className="w-4 h-4 text-amber-400" />
              )}
            </div>
            <span
              className={cn(
                "text-3xl font-bold tabular-nums",
                isP2Leading
                  ? "text-green-400"
                  : isP1Leading
                    ? "text-red-400"
                    : "text-foreground"
              )}
            >
              {totalScores.player2}
            </span>
          </div>
        </div>
      </div>

      {/* Round History */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          Rounds
        </h3>
        <div className="flex flex-col gap-2">
          {rounds.map((round) => (
            <RoundCard key={round.roundNumber} round={round} />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Link href="/score?method=photo" className="w-full">
          <Button size="lg" className="w-full h-14 text-base gap-2">
            <Camera className="w-5 h-5" />
            Scan board — Round {rounds.length + 1}
          </Button>
        </Link>
        <Link href="/score?method=manual" className="w-full">
          <Button
            size="lg"
            variant="outline"
            className="w-full h-14 text-base gap-2"
          >
            <Pencil className="w-5 h-5" />
            Manual entry — Round {rounds.length + 1}
          </Button>
        </Link>
        <Button
          size="lg"
          variant="outline"
          className="w-full h-14 text-base gap-2"
          onClick={() => {
            startNewGame();
            router.push("/");
          }}
        >
          <RotateCcw className="w-5 h-5" />
          New Game
        </Button>
      </div>
    </div>
  );
}

export function HomePageClient({
  emptyHero,
  emptyAppendix,
}: {
  emptyHero: ReactNode;
  emptyAppendix: ReactNode;
}) {
  const { rounds, includePurple, setIncludePurple } = useGame();
  const hasRounds = rounds.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <AppHeader />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 max-w-lg mx-auto w-full">
        {hasRounds ? <GameDashboard /> : <EmptyState hero={emptyHero} />}

        {/* Purple expedition toggle */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setIncludePurple(!includePurple)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card w-full max-w-sm mx-auto transition-colors hover:bg-accent"
          >
            <span className="text-lg">🔮</span>
            <div className="flex-1 text-left">
              <span className="text-sm font-medium">Purple Expedition</span>
              <span className="text-xs text-muted-foreground block">
                6th color expansion
              </span>
            </div>
            <div
              className={`relative w-11 h-6 rounded-full transition-colors ${includePurple ? "bg-violet-500" : "bg-muted"}`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${includePurple ? "translate-x-5" : "translate-x-0"}`}
              />
            </div>
          </button>
        </div>

        {!hasRounds && emptyAppendix}
      </main>
    </div>
  );
}
