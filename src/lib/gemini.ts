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

const ANALYSIS_PROMPT = `You are an expert at analyzing photos of the Lost Cities card game board. Study the image very carefully before answering.

## Board Layout — Separating Player 1 from Player 2

The board has a **center divider** — a horizontal row of colored expedition markers/icons running left to right across the middle. This divider splits the board into two halves:

- **Player 1 = BOTTOM half** (the side closest to the camera / bottom edge of the photo). Player 1's cards extend DOWNWARD from the center divider.
- **Player 2 = TOP half** (the side farthest from the camera / top edge of the photo). Player 2's cards extend UPWARD from the center divider.

**CRITICAL**: You MUST analyze each half of the board independently. A card on the bottom half belongs ONLY to Player 1. A card on the top half belongs ONLY to Player 2. Never combine or mix cards from both sides.

Within each half, cards are played in columns by color. Cards overlap/fan outward from the center so that the **upper-left corner** of each card (showing a number or handshake symbol) remains visible.

## Expedition Colors

Standard colors on every board: **yellow, blue, white, green, red**.
Some editions add a 6th color: **purple**. Include it only if you see a purple column.

Columns are typically arranged left-to-right: yellow, blue, white, green, red (and purple if present), though editions may vary.

## Card Types — How to Tell Them Apart

Each expedition color contains two types of cards:

1. **Wager (investment) cards** — There are exactly 3 wager cards per color in the game. They display a **handshake icon** (two hands shaking) and have **NO number** on them. The handshake symbol appears where a number would normally be. Wager cards are typically played first (closest to the center divider) before any numbered cards.

2. **Numbered cards** — Values **2 through 10** (one of each per color). They display a **large printed number** in the upper-left corner and elsewhere on the card.

**How to distinguish them**: Look at the upper-left corner of each card in a column.
- If you see a **number (2–10)** → it is a numbered card. Record that number.
- If you see a **handshake/hands icon with NO number** → it is a wager card. Count it toward wagerCount.

## Step-by-Step Analysis Process

For EACH color column, analyze the two sides separately:

**Player 1 (BOTTOM half):**
1. Find the color column in the bottom half of the board.
2. Starting from the card closest to the center divider, examine each card fanning downward.
3. For each card: Is there a number, or a handshake symbol?
4. Count all handshake-symbol cards → this is Player 1's wagerCount for that color.
5. List all visible numbers → this is Player 1's cardValues for that color (sorted ascending).

**Player 2 (TOP half):**
6. Find the SAME color column in the top half of the board.
7. Starting from the card closest to the center divider, examine each card fanning upward. Note: these cards may appear upside-down or at an angle from the camera's perspective.
8. For each card: Is there a number, or a handshake symbol?
9. Count all handshake-symbol cards → this is Player 2's wagerCount for that color.
10. List all visible numbers → this is Player 2's cardValues for that color (sorted ascending).

If a color has NO cards on a player's side, report wagerCount: 0, cardValues: [].

## Critical Rules

- A card with a number is ALWAYS a numbered card, never a wager.
- A wager card NEVER has a number — it shows ONLY the handshake symbol.
- Wager cards are commonly the first cards played (closest to the center), before numbered cards.
- Each numbered value (2–10) can appear at most once per color per player.
- Each color can have at most 3 wager cards per player.
- Look carefully at partially obscured cards — the upper-left corner is usually still visible.
- Player 2's cards may appear upside-down from the camera angle — look carefully.
- Always report card values in ascending numerical order.
- Include ALL colors visible on the board for BOTH players, even if a column is empty.
- NEVER assign a card from the bottom half to Player 2, or a card from the top half to Player 1.`;

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
            thinkingBudget: 8192,
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
