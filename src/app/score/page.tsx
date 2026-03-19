import { CachedScorePhotoScanNote } from "@/components/cached-marketing-blocks";
import { ScoreIndexRoute } from "./score-index-route";

/** Pick photo vs manual; deep links use `/score/photo` and `/score/manual` instead. */
export default function ScoreIndexPage() {
  return (
    <ScoreIndexRoute
      startStepPhotoNote={<CachedScorePhotoScanNote />}
    />
  );
}
