import { GoogleGenAI, ApiError } from "@google/genai";
import { analyzedGameSchema, type ValidatedGameData } from "./validation";

const MAX_APP_RETRIES = 3;
const INITIAL_BACKOFF_MS = 10_000;

let _client: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }
  _client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 60_000,
      retryOptions: {
        // Disable SDK-level retries — they fire too fast and burn through
        // the free-tier quota. We handle retries at the application level
        // with longer backoff instead.
        attempts: 1,
      },
    },
  });
  return _client;
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof ApiError && error.status === 429) return true;
  if (error instanceof Error) {
    const msg = error.message;
    return (
      msg.includes("Too Many Requests") ||
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("Retryable HTTP Error")
    );
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ANALYSIS_PROMPT = `You are an expert at analyzing photos of the Lost Cities card game board. Study the image carefully before answering.

## Board Layout

The Lost Cities board has a central row of colored expedition slots (columns). Each player plays cards on their own side of the board:
- **Player 1** plays on the **bottom/near side** (closest to the camera).
- **Player 2** plays on the **top/far side** (farthest from the camera).

Cards are played in columns by color extending outward from the center. Within each column, cards overlap so that the **number or symbol in the upper-left corner** of each card remains visible. The first card is closest to the center of the board; subsequent cards fan outward.

## Expedition Colors

There are 5 standard colors printed on every board: **yellow, blue, white, green, red**.
Some editions add a 6th color: **purple**. If you see a purple column on the board, include it.

The columns on the board are typically arranged left-to-right in this order (though it can vary by edition): yellow, blue, white, green, red (and purple if present).

## Card Types

Each expedition color has these cards:
1. **Wager (investment) cards** — exactly 3 per color. They show a **handshake symbol** and have **no number**. They are often played first in a column.
2. **Numbered cards** — values **2 through 10** (one of each per color). They display a **large number**.

## How to Read the Board

For each color column on each player's side:
1. Look at the column of fanned-out cards extending from the center toward that player.
2. Count cards showing a **handshake/investment symbol with no number** — these are wager cards. Report the total count (0, 1, 2, or 3).
3. Read every **visible number** on the remaining cards. Numbers appear prominently on each card. Report them as a sorted list.
4. If a color column has **no cards** on a player's side, report wagerCount 0 and an empty cardValues array.

## Critical Rules

- Cards with numbers on them are ALWAYS numbered cards, never wagers.
- Wager cards NEVER have a number — only the handshake symbol.
- Each numbered value (2–10) can appear at most once per color per player.
- Each color can have at most 3 wager cards per player.
- Look carefully at partially obscured cards — the upper-left corner number is usually still visible.
- Cards on the far side of the board (Player 2) may appear upside-down or at an angle from the camera's perspective.
- Always report card values in ascending numerical order.
- Include ALL colors visible on the board for BOTH players, even if a column is empty.`;

const EXPEDITION_SCHEMA = {
  type: "object" as const,
  properties: {
    color: {
      type: "string" as const,
      enum: ["yellow", "blue", "white", "green", "red", "purple"],
    },
    wagerCount: { type: "integer" as const },
    cardValues: {
      type: "array" as const,
      items: { type: "integer" as const },
    },
  },
  required: ["color", "wagerCount", "cardValues"],
};

const PLAYER_SCHEMA = {
  type: "object" as const,
  properties: {
    expeditions: { type: "array" as const, items: EXPEDITION_SCHEMA },
  },
  required: ["expeditions"],
};

const RESPONSE_SCHEMA = {
  type: "object" as const,
  properties: { player1: PLAYER_SCHEMA, player2: PLAYER_SCHEMA },
  required: ["player1", "player2"],
};

/**
 * Analyze a Lost Cities board photo using Google Gemini Vision.
 *
 * Uses gemini-2.5-flash for superior vision accuracy over flash-lite.
 * Enables thinking (thinkingBudget) so the model reasons about card
 * positions before producing structured output. Retries with exponential
 * backoff (10 s → 20 s → 40 s) on 429 rate-limit errors.
 */
export async function analyzeBoard(
  imageBase64: string
): Promise<ValidatedGameData> {
  const client = getClient();

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_APP_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      const jitter = backoff * (0.75 + Math.random() * 0.5);
      console.log(
        `Rate-limited – retrying in ${Math.round(jitter / 1000)}s (attempt ${attempt + 1}/${MAX_APP_RETRIES + 1})`
      );
      await sleep(jitter);
    }

    try {
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: ANALYSIS_PROMPT },
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          thinkingConfig: {
            thinkingBudget: 2048,
          },
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response from Gemini");
      }

      const parsed = JSON.parse(text);
      return analyzedGameSchema.parse(parsed);
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error)) throw error;
    }
  }

  throw lastError;
}
