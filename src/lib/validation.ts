import { z } from "zod";
import { EXPEDITION_COLORS_WITH_PURPLE } from "./types";

const expeditionSchema = z.object({
  color: z.enum(EXPEDITION_COLORS_WITH_PURPLE),
  wagerCount: z.number().int().min(0).max(3),
  cardValues: z.array(z.number().int().min(2).max(10)),
});

const playerSchema = z.object({
  expeditions: z.array(expeditionSchema),
});

export const analyzedGameSchema = z.object({
  player1: playerSchema,
  player2: playerSchema,
});

export type ValidatedGameData = z.infer<typeof analyzedGameSchema>;
