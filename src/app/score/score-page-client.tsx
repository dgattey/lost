"use client";

import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Camera, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoCapture } from "@/components/photo-capture";
import { ManualEntry } from "@/components/manual-entry";
import { ScoreResults } from "@/components/score-results";
import { AppHeader } from "@/components/app-header";
import { scoreGame } from "@/lib/scoring";
import { useGame } from "@/lib/game-context";
import { cropImageHalves } from "@/lib/image-utils";
import type {
  AppStep,
  ExpeditionColor,
  ExpeditionData,
  GameResult,
} from "@/lib/types";
import { EXPEDITION_COLORS, EXPEDITION_COLORS_WITH_PURPLE } from "@/lib/types";
import type { BoardLayout } from "@/lib/gemini";

function initialStepForMethod(
  method: "photo" | "manual" | null
): AppStep {
  if (method === "photo") return "capture";
  if (method === "manual") return "manual-entry";
  return "start";
}

function createEmptyExpeditions(includePurple: boolean): ExpeditionData[] {
  const colors: readonly ExpeditionColor[] = includePurple
    ? EXPEDITION_COLORS_WITH_PURPLE
    : EXPEDITION_COLORS;
  return colors.map((color) => ({
    color,
    wagerCount: 0,
    cardValues: [],
  }));
}

export function ScorePageClient({
  initialMethod,
  startStepPhotoNote,
}: {
  initialMethod: "photo" | "manual" | null;
  startStepPhotoNote: ReactNode | null;
}) {
  const router = useRouter();
  const { includePurple, setIncludePurple, addRound, rounds } = useGame();

  const skippedStartRef = useRef(initialMethod !== null);
  const [step, setStep] = useState<AppStep>(() =>
    initialStepForMethod(initialMethod)
  );
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boardImage, setBoardImage] = useState<string | null>(null);
  const [player1Data, setPlayer1Data] = useState<ExpeditionData[]>(
    createEmptyExpeditions(includePurple)
  );
  const [player2Data, setPlayer2Data] = useState<ExpeditionData[]>(
    createEmptyExpeditions(includePurple)
  );
  const [swapCount, setSwapCount] = useState(0);

  const handlePhotoAnalyze = useCallback(
    async (base64Image: string) => {
      setBoardImage(`data:image/jpeg;base64,${base64Image}`);
      setIsAnalyzing(true);
      setError(null);
      setStep("analyzing");

      try {
        // Step 1: Detect board layout (server-side)
        const layoutRes = await fetch("/api/analyze/layout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Image }),
        });
        const layoutResult = await layoutRes.json();
        if (!layoutRes.ok) throw new Error(layoutResult.error || "Layout detection failed");
        const layout = layoutResult.data as BoardLayout;

        // Step 2: Crop image into two halves (client-side, browser canvas)
        const { sideA, sideB } = await cropImageHalves(
          base64Image,
          layout.splitAxis,
          layout.splitPercent
        );

        // Step 3: Read cards from both halves (server-side, parallel)
        const [cardsARes, cardsBRes] = await Promise.all([
          fetch("/api/analyze/cards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: sideA, boardColors: layout.boardColors }),
          }),
          fetch("/api/analyze/cards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: sideB, boardColors: layout.boardColors }),
          }),
        ]);

        const [cardsAResult, cardsBResult] = await Promise.all([
          cardsARes.json(),
          cardsBRes.json(),
        ]);

        if (!cardsARes.ok) throw new Error(cardsAResult.error || "Card reading failed (Side A)");
        if (!cardsBRes.ok) throw new Error(cardsBResult.error || "Card reading failed (Side B)");

        const sideAExps = cardsAResult.data.expeditions as { color: string; wagerCount: number; cardValues: number[] }[];
        const sideBExps = cardsBResult.data.expeditions as { color: string; wagerCount: number; cardValues: number[] }[];

        // Detect purple
        const allExps = [...sideAExps, ...sideBExps];
        const aiFoundPurple = allExps.some(
          (e) => e.color === "purple" && (e.wagerCount > 0 || e.cardValues.length > 0)
        );
        const usePurple = includePurple || aiFoundPurple;
        if (aiFoundPurple && !includePurple) setIncludePurple(true);

        const colors: readonly ExpeditionColor[] = usePurple
          ? EXPEDITION_COLORS_WITH_PURPLE
          : EXPEDITION_COLORS;

        const mapExpeditions = (
          exps: { color: string; wagerCount: number; cardValues: number[] }[]
        ): ExpeditionData[] =>
          colors.map((color) => {
            const found = exps.find((e) => e.color === color);
            return {
              color,
              wagerCount: found?.wagerCount ?? 0,
              cardValues: found?.cardValues ?? [],
            };
          });

        // Side A → Player 1, Side B → Player 2 (user can swap in review)
        let p1Expeditions = mapExpeditions(sideAExps);
        let p2Expeditions = mapExpeditions(sideBExps);

        // Auto-swap to match previous round's player assignment
        const lastPhotoRound = [...rounds]
          .reverse()
          .find((r) => r.inputMethod === "photo");
        if (lastPhotoRound?.swapped) {
          [p1Expeditions, p2Expeditions] = [p2Expeditions, p1Expeditions];
          setSwapCount((c) => c + 1);
        }

        setPlayer1Data(p1Expeditions);
        setPlayer2Data(p2Expeditions);
        setStep("review");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        setError(message);
        setStep("capture");
      } finally {
        setIsAnalyzing(false);
      }
    },
    [includePurple, setIncludePurple, rounds]
  );

  const handleManualCalculate = useCallback(
    (p1: ExpeditionData[], p2: ExpeditionData[]) => {
      setPlayer1Data(p1);
      setPlayer2Data(p2);

      const result = scoreGame(
        { name: "Player 1", expeditions: p1 },
        { name: "Player 2", expeditions: p2 }
      );
      setGameResult(result);
      setStep("results");
    },
    []
  );

  const handleSaveRound = useCallback(() => {
    if (!gameResult) return;
    const isSwapped = swapCount % 2 === 1;
    addRound({
      result: gameResult,
      player1Expeditions: player1Data,
      player2Expeditions: player2Data,
      boardImage,
      inputMethod: boardImage ? "photo" : "manual",
      swapped: isSwapped,
    });
    router.push("/");
  }, [gameResult, addRound, player1Data, player2Data, boardImage, router, swapCount]);

  const handleEditCards = useCallback(() => {
    setStep("review");
  }, []);

  const handleBack = useCallback(() => {
    if (step === "capture" || step === "manual-entry") {
      if (skippedStartRef.current) {
        router.push("/");
        return;
      }
      setStep("start");
      return;
    }
    if (step === "analyzing") {
      setStep("capture");
      return;
    }
    if (step === "review") {
      setStep(skippedStartRef.current ? "capture" : "start");
      return;
    }
    if (step === "results") {
      setStep("review");
    }
  }, [step, router]);

  const backProps =
    step === "start"
      ? { backHref: "/" as string }
      : { onBack: handleBack };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <AppHeader
        {...backProps}
        title={`Score Round ${rounds.length + 1}`}
      />

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 max-w-lg mx-auto w-full">
        {/* START (bookmark / bare /score only) */}
        {step === "start" && (
          <div className="flex flex-col items-center gap-5 pt-4">
            <div className="text-center">
              <div className="text-4xl mb-3">🗺️</div>
              <h2 className="text-xl font-bold mb-1.5">
                Round {rounds.length + 1}
              </h2>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                Photo scan or manual entry — same as from the home screen.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-sm">
              <Button
                size="lg"
                className="w-full h-14 text-base gap-2"
                onClick={() => setStep("capture")}
              >
                <Camera className="w-5 h-5" />
                Scan Board Photo
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full h-14 text-base gap-2"
                onClick={() => setStep("manual-entry")}
              >
                <Pencil className="w-5 h-5" />
                Enter Cards Manually
              </Button>
            </div>

            {startStepPhotoNote}
          </div>
        )}

        {/* CAPTURE */}
        {(step === "capture" || step === "analyzing") && (
          <div className="flex flex-col items-center gap-4">
            {error && (
              <div className="w-full max-w-sm p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <p className="font-medium">Analysis failed</p>
                <p className="mt-1 text-destructive/80">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setError(null);
                    setStep("manual-entry");
                  }}
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  Enter manually instead
                </Button>
              </div>
            )}
            <PhotoCapture
              onAnalyze={handlePhotoAnalyze}
              isAnalyzing={isAnalyzing}
            />
          </div>
        )}

        {/* MANUAL ENTRY */}
        {step === "manual-entry" && (
          <ManualEntry
            onCalculate={handleManualCalculate}
            initialPlayer1={player1Data}
            initialPlayer2={player2Data}
            includePurple={includePurple}
            boardImage={boardImage}
          />
        )}

        {/* REVIEW */}
        {step === "review" && (
          <div className="flex flex-col gap-4">
            <div className="text-center py-2">
              <h2 className="text-lg font-bold">Review Detected Cards</h2>
              <p className="text-sm text-muted-foreground">
                Verify the cards below and fix any errors before scoring.
              </p>
            </div>
            {boardImage && (
              <Button
                variant="outline"
                size="sm"
                className="mx-auto gap-2"
                onClick={() => {
                  const temp = player1Data;
                  setPlayer1Data(player2Data);
                  setPlayer2Data(temp);
                  setSwapCount((c) => c + 1);
                }}
              >
                <ArrowLeftRight className="w-4 h-4" />
                Swap Players
              </Button>
            )}
            <ManualEntry
              key={swapCount}
              onCalculate={(p1, p2) => {
                setPlayer1Data(p1);
                setPlayer2Data(p2);
                const result = scoreGame(
                  { name: "Player 1", expeditions: p1 },
                  { name: "Player 2", expeditions: p2 }
                );
                setGameResult(result);
                setStep("results");
              }}
              initialPlayer1={player1Data}
              initialPlayer2={player2Data}
              includePurple={includePurple}
              boardImage={boardImage}
            />
          </div>
        )}

        {/* RESULTS */}
        {step === "results" && gameResult && (
          <ScoreResults
            result={gameResult}
            onPrimary={handleSaveRound}
            primaryLabel="Save Round"
            primaryIcon="check"
            onEditCards={handleEditCards}
          />
        )}
      </main>
    </div>
  );
}
