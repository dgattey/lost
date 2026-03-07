"use client";

import { useCallback, useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSelector } from "./card-selector";
import type { ExpeditionColor, ExpeditionData } from "@/lib/types";
import { EXPEDITION_COLORS } from "@/lib/types";

interface ManualEntryProps {
  onCalculate: (
    player1: ExpeditionData[],
    player2: ExpeditionData[]
  ) => void;
  initialPlayer1?: ExpeditionData[];
  initialPlayer2?: ExpeditionData[];
  includePurple?: boolean;
}

function createEmptyExpeditions(
  includePurple: boolean
): ExpeditionData[] {
  const colors: ExpeditionColor[] = includePurple
    ? [...EXPEDITION_COLORS, "purple"]
    : [...EXPEDITION_COLORS];
  return colors.map((color) => ({
    color,
    wagerCount: 0,
    cardValues: [],
  }));
}

export function ManualEntry({
  onCalculate,
  initialPlayer1,
  initialPlayer2,
  includePurple = false,
}: ManualEntryProps) {
  const [player1, setPlayer1] = useState<ExpeditionData[]>(
    initialPlayer1 ?? createEmptyExpeditions(includePurple)
  );
  const [player2, setPlayer2] = useState<ExpeditionData[]>(
    initialPlayer2 ?? createEmptyExpeditions(includePurple)
  );

  const updateExpedition = useCallback(
    (
      playerSetter: React.Dispatch<React.SetStateAction<ExpeditionData[]>>,
      colorIndex: number,
      update: Partial<ExpeditionData>
    ) => {
      playerSetter((prev) =>
        prev.map((exp, i) => (i === colorIndex ? { ...exp, ...update } : exp))
      );
    },
    []
  );

  const handleWagerChange = useCallback(
    (
      playerSetter: React.Dispatch<React.SetStateAction<ExpeditionData[]>>,
      colorIndex: number,
      count: number
    ) => {
      updateExpedition(playerSetter, colorIndex, { wagerCount: count });
    },
    [updateExpedition]
  );

  const handleCardToggle = useCallback(
    (
      playerSetter: React.Dispatch<React.SetStateAction<ExpeditionData[]>>,
      colorIndex: number,
      value: number,
      currentValues: number[]
    ) => {
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value].sort((a, b) => a - b);
      updateExpedition(playerSetter, colorIndex, { cardValues: newValues });
    },
    [updateExpedition]
  );

  const handleCalculate = useCallback(() => {
    onCalculate(player1, player2);
  }, [onCalculate, player1, player2]);

  const renderPlayerExpeditions = (
    expeditions: ExpeditionData[],
    playerSetter: React.Dispatch<React.SetStateAction<ExpeditionData[]>>
  ) => (
    <div className="flex flex-col gap-3">
      {expeditions.map((exp, i) => (
        <CardSelector
          key={exp.color}
          color={exp.color}
          wagerCount={exp.wagerCount}
          selectedValues={exp.cardValues}
          onWagerChange={(count) =>
            handleWagerChange(playerSetter, i, count)
          }
          onCardToggle={(value) =>
            handleCardToggle(playerSetter, i, value, exp.cardValues)
          }
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 w-full">
      <Tabs defaultValue="player1" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="player1" className="text-sm font-semibold">
            Player 1
          </TabsTrigger>
          <TabsTrigger value="player2" className="text-sm font-semibold">
            Player 2
          </TabsTrigger>
        </TabsList>
        <TabsContent value="player1" className="mt-4">
          {renderPlayerExpeditions(player1, setPlayer1)}
        </TabsContent>
        <TabsContent value="player2" className="mt-4">
          {renderPlayerExpeditions(player2, setPlayer2)}
        </TabsContent>
      </Tabs>

      <Button
        size="lg"
        className="w-full h-14 text-base gap-2 mt-2"
        onClick={handleCalculate}
      >
        <Calculator className="w-5 h-5" />
        Calculate Score
      </Button>
    </div>
  );
}
