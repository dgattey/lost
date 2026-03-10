"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoCapture } from "@/components/photo-capture";
import { ManualEntry } from "@/components/manual-entry";
import { ScoreResults } from "@/components/score-results";
import { AppHeader } from "@/components/app-header";
import { scoreGame } from "@/lib/scoring";
import { useGame } from "@/lib/game-context";
import type {
  AppStep,
  ExpeditionColor,
  ExpeditionData,
  GameResult,
  AnalyzedGameData,
} from "@/lib/types";
import { EXPEDITION_COLORS, EXPEDITION_COLORS_WITH_PURPLE } from "@/lib/types";

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

export default function ScorePage() {
  const router = useRouter();
  const { includePurple, setIncludePurple, addRound, rounds } = useGame();

  const [step, setStep] = useState<AppStep>("start");
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

  const handlePhotoAnalyze = useCallback(
    async (base64Image: string) => {
      setBoardImage(`data:image/jpeg;base64,${base64Image}`);
      setIsAnalyzing(true);
      setError(null);
      setStep("analyzing");

      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Image }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Analysis failed");
        }

        const data = result.data as AnalyzedGameData;

        const aiFoundPurple = [
          ...data.player1.expeditions,
          ...data.player2.expeditions,
        ].some(
          (e) =>
            e.color === "purple" &&
            (e.wagerCount > 0 || e.cardValues.length > 0)
        );
        const usePurple = includePurple || aiFoundPurple;
        if (aiFoundPurple && !includePurple) {
          setIncludePurple(true);
        }

        const colors: readonly ExpeditionColor[] = usePurple
          ? EXPEDITION_COLORS_WITH_PURPLE
          : EXPEDITION_COLORS;

        const mapExpeditions = (
          exps: AnalyzedGameData["player1"]["expeditions"]
        ): ExpeditionData[] => {
          return colors.map((color) => {
            const found = exps.find((e) => e.color === color);
            return {
              color,
              wagerCount: found?.wagerCount ?? 0,
              cardValues: found?.cardValues ?? [],
            };
          });
        };

        const p1Expeditions = mapExpeditions(data.player1.expeditions);
        const p2Expeditions = mapExpeditions(data.player2.expeditions);

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
    [includePurple, setIncludePurple]
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
    addRound({
      result: gameResult,
      player1Expeditions: player1Data,
      player2Expeditions: player2Data,
      boardImage,
      inputMethod: boardImage ? "photo" : "manual",
    });
    router.push("/");
  }, [gameResult, addRound, player1Data, player2Data, boardImage, router]);

  const handleEditCards = useCallback(() => {
    setStep("review");
  }, []);

  const handleBack = useCallback(() => {
    if (step === "capture" || step === "manual-entry") {
      setStep("start");
    } else if (step === "review") {
      setStep("start");
    } else if (step === "results") {
      setStep("review");
    }
  }, [step]);

  const backProps =
    step === "start"
      ? { backHref: "/" as string }
      : { onBack: handleBack };

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <AppHeader
        {...backProps}
        title={`Score Round ${rounds.length + 1}`}
      />

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        {/* START */}
        {step === "start" && (
          <div className="flex flex-col items-center gap-8 pt-8">
            <div className="text-center">
              <div className="text-5xl mb-4">🗺️</div>
              <h2 className="text-2xl font-bold mb-2">
                Round {rounds.length + 1}
              </h2>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                Take a photo of your Lost Cities board or enter cards manually
                to calculate scores.
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

            <div className="text-center text-xs text-muted-foreground max-w-xs">
              <p>Photo scanning requires an AI API key and a top-down photo of the full board.</p>
            </div>
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
            <ManualEntry
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
