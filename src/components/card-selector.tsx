"use client";

import { cn } from "@/lib/utils";
import { CARD_VALUES, EXPEDITION_CONFIG, MAX_WAGERS } from "@/lib/constants";
import type { ExpeditionColor } from "@/lib/types";

interface CardSelectorProps {
  color: ExpeditionColor;
  wagerCount: number;
  selectedValues: number[];
  onWagerChange: (count: number) => void;
  onCardToggle: (value: number) => void;
}

export function CardSelector({
  color,
  wagerCount,
  selectedValues,
  onWagerChange,
  onCardToggle,
}: CardSelectorProps) {
  const config = EXPEDITION_CONFIG[color];

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-3 transition-colors",
        config.borderClass,
        config.bgClass
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{config.emoji}</span>
        <span className={cn("font-semibold text-sm", config.textClass)}>
          {config.label}
        </span>
        {(wagerCount > 0 || selectedValues.length > 0) && (
          <span className="ml-auto text-xs text-muted-foreground">
            {wagerCount + selectedValues.length} card
            {wagerCount + selectedValues.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Wager buttons */}
      <div className="mb-2">
        <span className="text-xs text-muted-foreground block mb-1.5">
          Wagers
        </span>
        <div className="flex gap-2">
          {Array.from({ length: MAX_WAGERS + 1 }, (_, i) => (
            <button
              key={i}
              onClick={() => onWagerChange(i)}
              className={cn(
                "h-11 w-11 rounded-lg text-sm font-bold transition-all",
                "border border-border",
                "active:scale-95",
                i === wagerCount
                  ? "text-white shadow-md"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
              style={
                i === wagerCount ? { backgroundColor: config.hex } : undefined
              }
            >
              {i === 0 ? "—" : `×${i}`}
            </button>
          ))}
        </div>
      </div>

      {/* Card value buttons */}
      <div>
        <span className="text-xs text-muted-foreground block mb-1.5">
          Cards
        </span>
        <div className="grid grid-cols-9 gap-1.5">
          {CARD_VALUES.map((value) => {
            const isSelected = selectedValues.includes(value);
            return (
              <button
                key={value}
                onClick={() => onCardToggle(value)}
                className={cn(
                  "h-11 rounded-lg text-sm font-bold transition-all",
                  "border border-border",
                  "active:scale-95",
                  isSelected
                    ? "text-white shadow-md"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
                style={
                  isSelected ? { backgroundColor: config.hex } : undefined
                }
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
