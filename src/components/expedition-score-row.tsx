"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXPEDITION_CONFIG } from "@/lib/constants";
import type { ExpeditionScore } from "@/lib/types";

interface ExpeditionScoreRowProps {
  expeditionScore: ExpeditionScore;
}

export function ExpeditionScoreRow({
  expeditionScore,
}: ExpeditionScoreRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { expedition, score, breakdown } = expeditionScore;
  const config = EXPEDITION_CONFIG[expedition.color];
  const totalCards = expedition.wagerCount + expedition.cardValues.length;
  const isEmpty = totalCards === 0;

  return (
    <button
      className={cn(
        "w-full text-left rounded-lg border-l-4 p-3 transition-colors",
        "hover:bg-muted/50",
        isEmpty ? "opacity-40" : ""
      )}
      style={{ borderLeftColor: config.hex }}
      onClick={() => !isEmpty && setIsExpanded(!isExpanded)}
      disabled={isEmpty}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{config.emoji}</span>
          <span className={cn("font-medium text-sm", config.textClass)}>
            {config.label}
          </span>
          {!isEmpty && (
            <div className="flex items-center gap-1 ml-1">
              {/* Show wager indicators */}
              {Array.from({ length: expedition.wagerCount }, (_, i) => (
                <Handshake
                  key={i}
                  className="w-3.5 h-3.5"
                  style={{ color: config.hex }}
                />
              ))}
              {/* Show card values as small badges */}
              {expedition.cardValues.map((v) => (
                <span
                  key={v}
                  className="text-[10px] font-bold rounded px-1 py-0.5"
                  style={{
                    backgroundColor: config.hex + "30",
                    color: config.hex,
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-bold text-base tabular-nums",
              score > 0
                ? "text-green-400"
                : score < 0
                  ? "text-red-400"
                  : "text-muted-foreground"
            )}
          >
            {score > 0 ? `+${score}` : score}
          </span>
          {!isEmpty &&
            (isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ))}
        </div>
      </div>

      {/* Expanded breakdown */}
      {isExpanded && !isEmpty && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground font-mono">{breakdown}</p>
          {totalCards >= 8 && (
            <p className="text-xs text-amber-400 mt-1">
              🎯 8+ card bonus applied!
            </p>
          )}
        </div>
      )}
    </button>
  );
}
