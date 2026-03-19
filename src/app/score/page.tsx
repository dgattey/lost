import { CachedScorePhotoScanNote } from "@/components/cached-marketing-blocks";
import { ScorePageClient } from "./score-page-client";

type ScoreSearchParams = { method?: string | string[] };

function parseMethod(
  raw: string | string[] | undefined
): "photo" | "manual" | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "photo" || v === "manual" ? v : null;
}

export default async function ScorePage({
  searchParams,
}: {
  searchParams: Promise<ScoreSearchParams>;
}) {
  const sp = await searchParams;
  const initialMethod = parseMethod(sp.method);

  return (
    <ScorePageClient
      initialMethod={initialMethod}
      startStepPhotoNote={
        initialMethod ? null : <CachedScorePhotoScanNote />
      }
    />
  );
}
