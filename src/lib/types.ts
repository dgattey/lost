export const EXPEDITION_COLORS = [
  "yellow",
  "blue",
  "white",
  "green",
  "red",
] as const;

export const EXPEDITION_COLORS_WITH_PURPLE = [
  ...EXPEDITION_COLORS,
  "purple",
] as const;

export type ExpeditionColor = (typeof EXPEDITION_COLORS_WITH_PURPLE)[number];

export interface ExpeditionData {
  color: ExpeditionColor;
  wagerCount: number; // 0-3
  cardValues: number[]; // each value 2-10
}

export interface ExpeditionScore {
  expedition: ExpeditionData;
  score: number;
  breakdown: string;
}

export interface PlayerData {
  name: string;
  expeditions: ExpeditionData[];
}

export interface PlayerResult {
  name: string;
  expeditions: ExpeditionScore[];
  totalScore: number;
}

export interface GameResult {
  player1: PlayerResult;
  player2: PlayerResult;
  winner: string | null; // null = tie
}

export type AppStep =
  | "start"
  | "capture"
  | "analyzing"
  | "manual-entry"
  | "review"
  | "results";

/** Data shape returned by the Gemini vision API */
export interface AnalyzedGameData {
  player1: {
    expeditions: {
      color: string;
      wagerCount: number;
      cardValues: number[];
    }[];
  };
  player2: {
    expeditions: {
      color: string;
      wagerCount: number;
      cardValues: number[];
    }[];
  };
}
