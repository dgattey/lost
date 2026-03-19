"use client";

import type { ReactNode } from "react";
import { useGame } from "@/lib/game-context";
import { ScorePageClient } from "./score-page-client";

/** Remount when `rounds.length` changes so the /score picker does not keep stale flow state. */
export function ScoreIndexRoute({
  startStepPhotoNote,
}: {
  startStepPhotoNote: ReactNode;
}) {
  const { rounds } = useGame();
  return (
    <ScorePageClient
      key={`score-index-${rounds.length}`}
      initialMethod={null}
      startStepPhotoNote={startStepPhotoNote}
    />
  );
}
