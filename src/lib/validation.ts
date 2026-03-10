import { z } from "zod";
import { EXPEDITION_COLORS_WITH_PURPLE } from "./types";

const expeditionSchema = z
  .object({
    color: z.enum(EXPEDITION_COLORS_WITH_PURPLE),
    totalCardsInColumn: z.number().int().min(0).max(12),
    wagerCount: z.number().int().min(0).max(3),
    cardValues: z.array(z.number().int().min(2).max(10)),
  })
  .transform((exp) => {
    const numCards = exp.cardValues.length;
    const expectedTotal = exp.wagerCount + numCards;

    let correctedWagerCount = exp.wagerCount;

    if (exp.totalCardsInColumn > 0 && expectedTotal !== exp.totalCardsInColumn) {
      const derived = Math.max(0, Math.min(3, exp.totalCardsInColumn - numCards));
      if (derived !== exp.wagerCount) {
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
      cardValues: exp.cardValues,
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
