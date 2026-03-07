import type { ExpeditionColor } from "./types";

export const EXPEDITION_COST = 20;
export const BONUS_THRESHOLD = 8;
export const BONUS_POINTS = 20;
export const CARD_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const MAX_WAGERS = 3;

/** Display info for each expedition color */
export const EXPEDITION_CONFIG: Record<
  ExpeditionColor,
  {
    label: string;
    emoji: string;
    cssClass: string;
    hex: string;
    textClass: string;
    bgClass: string;
    borderClass: string;
  }
> = {
  yellow: {
    label: "Yellow",
    emoji: "🏜️",
    cssClass: "expedition-yellow",
    hex: "#f59e0b",
    textClass: "text-amber-500",
    bgClass: "bg-amber-500/20",
    borderClass: "border-amber-500",
  },
  blue: {
    label: "Blue",
    emoji: "🌊",
    cssClass: "expedition-blue",
    hex: "#3b82f6",
    textClass: "text-blue-500",
    bgClass: "bg-blue-500/20",
    borderClass: "border-blue-500",
  },
  white: {
    label: "White",
    emoji: "🏔️",
    cssClass: "expedition-white",
    hex: "#d1d5db",
    textClass: "text-gray-300",
    bgClass: "bg-gray-300/20",
    borderClass: "border-gray-300",
  },
  green: {
    label: "Green",
    emoji: "🌿",
    cssClass: "expedition-green",
    hex: "#22c55e",
    textClass: "text-green-500",
    bgClass: "bg-green-500/20",
    borderClass: "border-green-500",
  },
  red: {
    label: "Red",
    emoji: "🌋",
    cssClass: "expedition-red",
    hex: "#ef4444",
    textClass: "text-red-500",
    bgClass: "bg-red-500/20",
    borderClass: "border-red-500",
  },
  purple: {
    label: "Purple",
    emoji: "🔮",
    cssClass: "expedition-purple",
    hex: "#8b5cf6",
    textClass: "text-violet-500",
    bgClass: "bg-violet-500/20",
    borderClass: "border-violet-500",
  },
};
