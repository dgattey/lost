import { CachedScorePhotoScanNote } from "@/components/cached-marketing-blocks";
import { ScorePageClient } from "./score-page-client";

export default function ScorePage() {
  return (
    <ScorePageClient
      startStepPhotoNote={<CachedScorePhotoScanNote />}
    />
  );
}
