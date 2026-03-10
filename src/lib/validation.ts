import { z } from "zod";
import { EXPEDITION_COLORS_WITH_PURPLE } from "./types";

/** Shape of the raw JSON from Gemini before validation/correction */
export interface RawAnalyzedGameData {
  player1: {
    expeditions: {
      color: string;
      totalCardsInColumn: number;
      wagerCount: number;
      cardValues: number[];
    }[];
  };
  player2: {
    expeditions: {
      color: string;
      totalCardsInColumn: number;
      wagerCount: number;
      cardValues: number[];
    }[];
  };
}

const expeditionSchema = z
  .object({
    color: z.enum(EXPEDITION_COLORS_WITH_PURPLE),
    totalCardsInColumn: z.number().int().min(0),
    wagerCount: z.number().int().min(0),
    cardValues: z.array(z.number().int().min(2).max(10)),
  })
  .transform((exp) => {
    // Deduplicate and filter card values
    const uniqueCards = [...new Set(exp.cardValues)]
      .filter((v) => v >= 2 && v <= 10)
      .sort((a, b) => a - b);

    const numCards = uniqueCards.length;

    // Derive wager count from totalCardsInColumn when available
    let correctedWagerCount = Math.max(0, Math.min(3, exp.wagerCount));

    if (exp.totalCardsInColumn > 0) {
      const derived = Math.max(
        0,
        Math.min(3, exp.totalCardsInColumn - numCards)
      );
      if (derived !== correctedWagerCount) {
        console.log(
          `[validation] ${exp.color}: correcting wagerCount from ${exp.wagerCount} to ${derived} ` +
            `(totalCards=${exp.totalCardsInColumn}, numbered=${numCards})`
        );
        correctedWagerCount = derived;
      }
    }

    return {
      color: exp.color,
      wagerCount: correctedWagerCount,
      cardValues: uniqueCards,
    };
  });

const playerSchema = z.object({
  expeditions: z.array(expeditionSchema),
});

export const analyzedGameSchema = z.object({
  player1: playerSchema,
  player2: playerSchema,
});

export type ValidatedGameData = z.infer<typeof analyzedGameSchema>;
