import { CachedScorePhotoScanNote } from "@/components/cached-marketing-blocks";
import { ScorePageClient } from "./score-page-client";

/** Pick photo vs manual; deep links use `/score/photo` and `/score/manual` instead. */
export default function ScoreIndexPage() {
  return (
    <ScorePageClient
      initialMethod={null}
      startStepPhotoNote={<CachedScorePhotoScanNote />}
    />
  );
}
