import { ScorePageClient } from "../score-page-client";

export default function ScoreManualPage() {
  return (
    <ScorePageClient initialMethod="manual" startStepPhotoNote={null} />
  );
}
