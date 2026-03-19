"use client";

import { useGame } from "@/lib/game-context";
import { ScorePageClient } from "./score-page-client";

/** Remount when `rounds.length` changes so a new round never inherits prior step/results state. */
export function ScoreManualRoute() {
  const { rounds } = useGame();
  return (
    <ScorePageClient
      key={`score-manual-${rounds.length}`}
      initialMethod="manual"
      startStepPhotoNote={null}
    />
  );
}
