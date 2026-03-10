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

## Board Layout — Identifying the Center and Two Sides

The Lost Cities board has a **center strip** — a narrow column or row of colored expedition markers/icons. This strip separates the board into two distinct sides. Each player's played cards fan outward from the center strip toward their side of the table.

**The center strip may be oriented in any direction depending on how the photo was taken:**
- It may run **horizontally** (left to right) with cards fanning up and down.
- It may run **vertically** (top to bottom) with cards fanning left and right.
- It may be at an angle.
- The photo may be taken from **directly above** (bird's eye / top-down view).

**How to find it:** Look for the narrow strip of colorful expedition artwork (showing small illustrations in yellow, blue, white, green, red, and possibly purple). This is the center divider. Cards are played on BOTH sides of this strip, fanning outward.

## Identifying Player 1 vs Player 2

Once you locate the center strip:
- **Player 1** = the side closest to the camera / bottom edge of the photo. Cards fan outward from the center toward the camera.
- **Player 2** = the side farthest from the camera / top edge of the photo. Cards fan outward from the center away from the camera.

**CRITICAL**: Each side of the board is scored completely independently. A player may have cards in some expedition colors but not others. Do NOT combine cards from both sides into one player. Analyze each side separately.

It is completely normal for one player to have cards in colors that the other player does not. For example, Player 1 might have yellow, blue, and green expeditions while Player 2 has white, red, and purple.

## Expedition Colors

Standard colors on every board: **yellow, blue, white, green, red**.
Some editions add a 6th color: **purple**. Include it only if you see a purple column on the center strip.

The colors on the center strip are arranged in order (typically: yellow, blue, white, green, red, and purple if present). Each color column on the center strip has a matching color of cards on either side.

## Card Types — How to Tell Them Apart

This is critical. Each expedition color has two types of cards, and you MUST distinguish between them:

### Wager (Investment/Handshake) Cards
- There are exactly **3 wager cards per color** in the game (so up to 3 can appear in a single column).
- They show a **handshake illustration** — two hands clasping/shaking — as the main artwork on the card face.
- **They have NO number.** Where a numbered card would show a digit (like "5" or "8"), a wager card instead shows the handshake symbol.
- In the **upper-left corner**, instead of a number, there is a **small handshake icon** or the corner may show the expedition symbol without any digit.
- Wager cards are almost always played **first** in a column, meaning they sit **closest to the center strip** before any numbered cards.
- Wager cards have the same colored border/background as their expedition color, so they blend in visually with the numbered cards.

### Numbered Cards
- Values **2 through 10** (one of each per color).
- They display a **large printed number** prominently on the card face and in the **upper-left corner**.
- Easy to identify: if you can read a digit on the card, it's a numbered card.

## Counting Wager Cards — This Is the Hardest Part

Wager cards look nearly identical to each other (same handshake art, same color). When 2 or 3 are stacked, they overlap and are easy to undercount. Use these techniques:

1. **Count card edges**: Each physical card in a fan/stack has its own visible edge or corner. Count the number of separate card edges you can see between the center strip and the first numbered card. Each edge = one card.
2. **Look for offset corners**: When multiple wager cards are stacked, each one's corner is slightly offset from the previous. Count these offset corners.
3. **Check card thickness**: A thicker-looking "card" near the center strip may actually be 2 or 3 overlapping wager cards. Look for any separation lines between them.
4. **Cross-check with total count**: After identifying all cards in a column, verify: total card edges visible = wagerCount + number of cardValues. If these don't add up, recount.

**Common mistake**: Seeing multiple overlapping wager cards but counting them as just 1. Always look for evidence of additional cards underneath.

## Step-by-Step Analysis Process

Follow this process methodically:

**Step 1: Find the center strip** and determine its orientation.

**Step 2: Identify which side is Player 1 and which is Player 2.**

**Step 3: For EACH expedition color, analyze Player 1's side:**
1. Count the **total number of separate card edges** visible on Player 1's side of that color.
2. Starting from the card nearest the center strip, examine each card:
   - No number / handshake symbol → wager card (increment wagerCount)
   - Visible number (2–10) → numbered card (add to cardValues)
3. Verify: wagerCount + len(cardValues) should equal the total card edges you counted.
4. If the numbers don't add up, look again for missed wager cards or missed numbered cards.
5. If no cards for this color on Player 1's side → wagerCount: 0, cardValues: [].

**Step 4: For EACH expedition color, analyze Player 2's side** using the same process. Cards on the far side may appear upside-down or at an angle — look carefully at each one.

## Critical Rules

- A card with a number is ALWAYS a numbered card, never a wager.
- A wager card NEVER has a number — it shows ONLY the handshake symbol.
- Wager cards sit closest to the center strip, before numbered cards in a column.
- Each numbered value (2–10) can appear at most once per color per player.
- Each color can have at most 3 wager cards per player.
- Having 2 or 3 wager cards in a single expedition is VERY COMMON. Do NOT default to 0 or 1 — carefully count card edges near the center.
- Look carefully at partially obscured cards — the upper-left corner is usually still visible.
- Cards on the far side of the board may appear upside-down or at an angle — look carefully.
- Always report card values in ascending numerical order.
- Include ALL colors visible on the board for BOTH players, even if a column is empty for one of them.
- NEVER mix cards from one side of the board into the other player's results.`;

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
            thinkingBudget: 16384,
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
