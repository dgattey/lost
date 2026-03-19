"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Camera,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";
import { ScoreResults } from "@/components/score-results";
import { ManualEntry } from "@/components/manual-entry";
import { useGame } from "@/lib/game-context";
import { scoreGame } from "@/lib/scoring";
import type { ExpeditionData } from "@/lib/types";

export default function RoundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const roundNumber = parseInt(id, 10);
  const router = useRouter();
  const { getRound, swapPlayersForRound, updateRound, includePurple } =
    useGame();
  const [editing, setEditing] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);

  const round = getRound(roundNumber);

  if (!round) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <AppHeader backHref="/" title="Round Not Found" />
        <main className="mx-auto flex min-h-0 w-full max-w-lg min-w-0 flex-1 flex-col overflow-y-auto px-4 py-6">
          <div className="text-center pt-12">
            <div className="text-4xl mb-4">🔍</div>
            <h2 className="text-lg font-bold mb-2">Round not found</h2>
            <p className="text-sm text-muted-foreground">
              This round doesn&apos;t exist.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const handleSwap = () => {
    swapPlayersForRound(roundNumber);
  };

  const handleEditSave = (p1: ExpeditionData[], p2: ExpeditionData[]) => {
    const result = scoreGame(
      { name: "Player 1", expeditions: p1 },
      { name: "Player 2", expeditions: p2 }
    );
    updateRound(roundNumber, {
      result,
      player1Expeditions: p1,
      player2Expeditions: p2,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <AppHeader
          onBack={() => setEditing(false)}
          title={`Edit Round ${roundNumber}`}
        />
        <main className="mx-auto flex min-h-0 w-full max-w-lg min-w-0 flex-1 flex-col overflow-y-auto px-4 py-6">
          <div className="flex flex-col gap-4">
            <div className="text-center py-2">
              <h2 className="text-lg font-bold">Edit Cards</h2>
              <p className="text-sm text-muted-foreground">
                Update the cards for Round {roundNumber}.
              </p>
            </div>
            <ManualEntry
              onCalculate={handleEditSave}
              initialPlayer1={round.player1Expeditions}
              initialPlayer2={round.player2Expeditions}
              includePurple={includePurple}
              boardImage={round.boardImage}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <AppHeader backHref="/" title={`Round ${roundNumber}`} />
      <main className="mx-auto flex min-h-0 w-full max-w-lg min-w-0 flex-1 flex-col overflow-y-auto px-4 py-6">
        <div className="flex flex-col gap-4">
          {/* Round metadata */}
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
            {round.inputMethod === "photo" && (
              <span className="flex items-center gap-1">
                <Camera className="w-3.5 h-3.5" />
                Photo scanned
              </span>
            )}
            {round.inputMethod === "manual" && (
              <span className="flex items-center gap-1">
                <Pencil className="w-3.5 h-3.5" />
                Manual entry
              </span>
            )}
            <span>•</span>
            <span>
              {new Date(round.timestamp).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            {round.swapped && (
              <>
                <span>•</span>
                <span className="text-amber-400">Swapped</span>
              </>
            )}
          </div>

          {/* Board photo reference */}
          {round.boardImage && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setImageExpanded((prev) => !prev)}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                <span className="flex-1 text-left">
                  Board Photo Reference
                </span>
                {imageExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {imageExpanded && (
                <div className="px-2 pb-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={round.boardImage}
                    alt="Board photo reference"
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              )}
            </div>
          )}

          {/* Score results */}
          <ScoreResults
            result={round.result}
            onPrimary={() => router.push("/")}
            primaryLabel="Back to Game"
            primaryIcon="back"
            onEditCards={() => setEditing(true)}
            extraActions={
              <Button
                size="lg"
                variant="outline"
                className="w-full h-14 text-base gap-2"
                onClick={handleSwap}
              >
                <ArrowLeftRight className="w-5 h-5" />
                Swap Players
              </Button>
            }
          />
        </div>
      </main>
    </div>
  );
}
