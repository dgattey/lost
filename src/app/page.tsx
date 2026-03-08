"use client";

import { useCallback, useState } from "react";
import { Camera, Pencil, ArrowLeft, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoCapture } from "@/components/photo-capture";
import { ManualEntry } from "@/components/manual-entry";
import { ScoreResults } from "@/components/score-results";
import { scoreGame } from "@/lib/scoring";
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

export default function Home() {
  const [step, setStep] = useState<AppStep>("start");
  const [includePurple, setIncludePurple] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boardImage, setBoardImage] = useState<string | null>(null);
  const [player1Data, setPlayer1Data] = useState<ExpeditionData[]>(
    createEmptyExpeditions(false)
  );
  const [player2Data, setPlayer2Data] = useState<ExpeditionData[]>(
    createEmptyExpeditions(false)
  );

  const handlePhotoAnalyze = useCallback(async (base64Image: string) => {
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

      // Detect whether AI found any purple expeditions
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

      // Go to review step so user can verify/edit before scoring
      setStep("review");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setStep("capture");
    } finally {
      setIsAnalyzing(false);
    }
  }, [includePurple]);

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

  const handleCalculateFromReview = useCallback(() => {
    const result = scoreGame(
      { name: "Player 1", expeditions: player1Data },
      { name: "Player 2", expeditions: player2Data }
    );
    setGameResult(result);
    setStep("results");
  }, [player1Data, player2Data]);

  const handleReset = useCallback(() => {
    setStep("start");
    setGameResult(null);
    setError(null);
    setBoardImage(null);
    setPlayer1Data(createEmptyExpeditions(includePurple));
    setPlayer2Data(createEmptyExpeditions(includePurple));
  }, [includePurple]);

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

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center h-14 px-4 max-w-lg mx-auto">
          {step !== "start" && (
            <Button
              variant="ghost"
              size="icon"
              className="mr-2"
              onClick={handleBack}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-amber-500" />
            <h1 className="font-bold text-base">Lost Cities Scorer</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        {/* START */}
        {step === "start" && (
          <div className="flex flex-col items-center gap-8 pt-8">
            <div className="text-center">
              <div className="text-5xl mb-4">🗺️</div>
              <h2 className="text-2xl font-bold mb-2">Score Your Game</h2>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                Take a photo of your Lost Cities board or enter cards manually
                to calculate scores instantly.
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

            {/* Purple expedition toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !includePurple;
                setIncludePurple(next);
                setPlayer1Data(createEmptyExpeditions(next));
                setPlayer2Data(createEmptyExpeditions(next));
              }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card w-full max-w-sm transition-colors hover:bg-accent"
            >
              <span className="text-lg">🔮</span>
              <div className="flex-1 text-left">
                <span className="text-sm font-medium">Purple Expedition</span>
                <span className="text-xs text-muted-foreground block">
                  6th color expansion
                </span>
              </div>
              <div
                className={`relative w-11 h-6 rounded-full transition-colors ${includePurple ? "bg-violet-500" : "bg-muted"}`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${includePurple ? "translate-x-5" : "translate-x-0"}`}
                />
              </div>
            </button>

            <div className="text-center text-xs text-muted-foreground max-w-xs">
              <p>
                Photo scanning requires an AI API key.
              </p>
            </div>

            <footer className="text-center text-xs text-muted-foreground/70 max-w-xs pt-4 border-t border-border/50 space-y-2">
              <p>
                <a
                  href="https://www.amazon.com/s?k=Lost+Cities+Card+Game"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Buy Lost Cities
                </a>
              </p>
              <p>
                This app is a fan-made scoring tool and is not affiliated with,
                endorsed by, or associated with Kosmos, Thames &amp; Kosmos, or
                the creators of Lost Cities.
              </p>
            </footer>
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

        {/* REVIEW (edit AI results before scoring) */}
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
            onReset={handleReset}
            onEditCards={handleEditCards}
          />
        )}
      </main>
    </div>
  );
}
