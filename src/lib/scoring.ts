import { BONUS_POINTS, BONUS_THRESHOLD, EXPEDITION_COST } from "./constants";
import type {
  ExpeditionData,
  ExpeditionScore,
  GameResult,
  PlayerData,
  PlayerResult,
} from "./types";

/**
 * Score a single expedition.
 *
 * Rules:
 * 1. If no cards at all (no wagers, no numbered cards) → 0
 * 2. Sum numbered card values, subtract 20 (expedition cost)
 * 3. Multiply by (1 + wagerCount)
 * 4. If total card count (wagers + numbered) >= 8, add 20 bonus AFTER multiplier
 */
export function scoreExpedition(expedition: ExpeditionData): ExpeditionScore {
  const { wagerCount, cardValues } = expedition;
  const totalCards = wagerCount + cardValues.length;

  // No cards played at all → score is 0
  if (totalCards === 0) {
    return {
      expedition,
      score: 0,
      breakdown: "No cards played",
    };
  }

  const cardSum = cardValues.reduce((sum, v) => sum + v, 0);
  const afterCost = cardSum - EXPEDITION_COST;
  const multiplier = 1 + wagerCount;
  const multiplied = afterCost * multiplier;
  const hasBonus = totalCards >= BONUS_THRESHOLD;
  const finalScore = hasBonus ? multiplied + BONUS_POINTS : multiplied;

  // Build human-readable breakdown
  const parts: string[] = [];

  if (cardValues.length > 0) {
    parts.push(`(${cardValues.join(" + ")} − ${EXPEDITION_COST})`);
  } else {
    parts.push(`(0 − ${EXPEDITION_COST})`);
  }

  if (multiplier > 1) {
    parts.push(`× ${multiplier}`);
  }

  let breakdown = parts.join(" ");
  breakdown += ` = ${multiplied}`;

  if (hasBonus) {
    breakdown += ` + ${BONUS_POINTS} bonus = ${finalScore}`;
  }

  return {
    expedition,
    score: finalScore,
    breakdown,
  };
}

/** Score all expeditions for a player */
export function scorePlayer(player: PlayerData): PlayerResult {
  const expeditions = player.expeditions.map(scoreExpedition);
  const totalScore = expeditions.reduce((sum, e) => sum + e.score, 0);

  return {
    name: player.name,
    expeditions,
    totalScore,
  };
}

/** Score the full game for both players */
export function scoreGame(
  player1: PlayerData,
  player2: PlayerData
): GameResult {
  const p1 = scorePlayer(player1);
  const p2 = scorePlayer(player2);

  let winner: string | null = null;
  if (p1.totalScore > p2.totalScore) {
    winner = p1.name;
  } else if (p2.totalScore > p1.totalScore) {
    winner = p2.name;
  }

  return { player1: p1, player2: p2, winner };
}
