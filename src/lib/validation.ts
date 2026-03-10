import { z } from "zod";
import { EXPEDITION_COLORS_WITH_PURPLE } from "./types";

/** Shape of a single expedition from Gemini before validation/correction */
export interface RawPlayerExpedition {
  color: string;
  totalCardsInColumn: number;
  wagerCount: number;
  cardValues: number[];
}

/** Shape of the raw JSON from Gemini before validation/correction */
export interface RawAnalyzedGameData {
  player1: { expeditions: RawPlayerExpedition[] };
  player2: { expeditions: RawPlayerExpedition[] };
}

const expeditionSchema = z
  .object({
    color: z.enum(EXPEDITION_COLORS_WITH_PURPLE),
    totalCardsInColumn: z.number().int(),
    wagerCount: z.number().int(),
    cardValues: z.array(z.number().int().min(2).max(10)),
  })
  .transform((exp) => {
    const uniqueCards = [...new Set(exp.cardValues)]
      .filter((v) => v >= 2 && v <= 10)
      .sort((a, b) => a - b);

    const numCards = uniqueCards.length;

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
