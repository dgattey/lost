"use client";

import { useGame } from "@/lib/game-context";
import { ScorePageClient } from "./score-page-client";

/** Remount when `rounds.length` changes so a new round never inherits prior step/results state. */
export function ScorePhotoRoute() {
  const { rounds } = useGame();
  return (
    <ScorePageClient
      key={`score-photo-${rounds.length}`}
      initialMethod="photo"
      startStepPhotoNote={null}
    />
  );
}
