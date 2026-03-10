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

const ANALYSIS_PROMPT = `You are an expert at analyzing photos of the Lost Cities card game board. Study the image VERY carefully before answering. Take your time — accuracy is far more important than speed.

## STEP 1: Find the Center Board Strip

The Lost Cities board has a **center strip** — a long, narrow board piece decorated with colored expedition artwork. It has 5 or 6 colored sections (yellow, blue, white, green, red, and optionally purple).

**The center strip may be oriented in any direction.** It might run horizontally, vertically, or at an angle depending on how the photo was taken.

**How to identify it:** It's the physical game board piece — a rigid strip with colorful expedition illustrations printed on it. It is NOT a card. Each colored section has a small illustration matching that expedition's theme. Cards are played on BOTH sides of this strip.

## STEP 2: Identify Played Card Columns vs Scattered Cards

This is the MOST CRITICAL step. You must distinguish between:

### ✅ PLAYED CARDS (count these)
- Organized in **neat columns or fans** extending outward from the center strip
- Each column is aligned with one of the colored sections on the center strip
- Cards within a column overlap in an orderly fan so you can see the top-left corner of each card
- The column extends from the center strip outward toward a player's side

### ❌ NOT PLAYED CARDS (IGNORE these completely)
- **Scattered/loose cards** lying on the table but NOT in an organized column from the center strip
- **Cards in players' hands** or being held
- **Discard pile cards** sitting ON TOP of the center strip itself
- **Cards at the edges or corners** of the table that aren't connected to a column
- Any cards that are **randomly arranged**, not fanned in a neat column

**CRITICAL ERROR TO AVOID:** If you see cards of a certain color lying near the table edge or scattered about, but they are NOT part of an organized column extending from the center strip, do NOT count them for either player. These are likely cards in a draw pile, a player's hand, or discards.

## STEP 3: Identify Player 1 vs Player 2

Once you find the center strip:
- **Player 1** = cards fanning outward from the center strip toward the **bottom/near edge** of the photo (closer to camera)
- **Player 2** = cards fanning outward from the center strip toward the **top/far edge** of the photo (away from camera)

If the board is sideways: Player 1 = left side, Player 2 = right side. Use the center strip as the dividing line.

**CRITICAL**: Analyze each side COMPLETELY INDEPENDENTLY. Do NOT mix cards from one side into the other. A player may have expeditions in some colors but not others — this is normal.

## STEP 4: Identify Expedition Colors on Each Card

Lost Cities cards have distinct color themes. Match each card's COLOR to the expedition:
- **Yellow** — Desert/sand artwork, amber/gold card borders, warm yellow tones
- **Blue** — Ocean/water artwork, blue card borders, cool blue tones
- **White** — Snow/mountain/ice artwork, white/grey card borders, pale/silver tones
- **Green** — Jungle/vegetation artwork, green card borders, forest green tones
- **Red** — Volcano/fire/lava artwork, red card borders, bright red tones
- **Purple** — Crystal/cave artwork, purple/violet card borders, deep purple tones (only in 6-color editions)

**IMPORTANT:** A card's color should match the center strip section it is aligned with. If a card is in the column extending from the yellow section of the center strip, it should be a yellow card. If there's a mismatch, re-examine which column the card actually belongs to.

## STEP 5: Count Total Cards in Each Column (CRITICAL)

**This step is essential for accuracy.** Before identifying individual cards, first COUNT the total number of physical cards in each column by counting card edges, corners, or visible separations.

Each physical card in a fanned column has its own visible edge or corner that sticks out. Count these carefully:
- Look along the edge of each column for distinct card corners/edges
- Pay special attention to the cards CLOSEST to the center strip — wager cards overlap heavily and are easy to miss
- If the stack looks "thicker" near the center strip, it likely has multiple wager cards underneath

Report this count as **totalCardsInColumn** for each expedition.

## STEP 6: Identify Numbered Cards

Go through each column and identify every card that has a **visible printed number** (2–10). These are the numbered cards. Add them to **cardValues**.

Numbers appear both as large text on the card face and in the upper-left corner. If you can see any digit on a card, it's a numbered card.

## STEP 7: Calculate Wager Count from the Difference

**wagerCount = totalCardsInColumn − number of identified numbered cards**

Wager (handshake) cards are the ones WITHOUT a number. They show a handshake illustration and sit closest to the center strip. Rather than trying to identify them visually (which is hard when they overlap), use the MATH:
- If you counted 7 total card edges in a column but only found 6 numbered cards → **wagerCount = 1**
- If you counted 10 total card edges but only found 7 numbered cards → **wagerCount = 3**
- If the total matches the numbered cards exactly → **wagerCount = 0**

This is more reliable than trying to visually identify handshake symbols on overlapping cards.

## STEP 8: Final Verification Checklist

Before producing your answer, verify:
- [ ] Every card you counted is part of an ORGANIZED COLUMN extending from the center strip
- [ ] NO scattered, loose, or hand-held cards were counted
- [ ] NO cards sitting ON the center strip (discards) were counted
- [ ] Each card was assigned to ONLY ONE player (the player on that card's side of the center strip)
- [ ] Card colors match their column's position on the center strip
- [ ] No numbered value appears twice in the same color for the same player
- [ ] For each column: totalCardsInColumn = wagerCount + count(cardValues)
- [ ] Wager count is 0–3 for each expedition
- [ ] Card values are reported in ascending order

## Rules Summary

- Only count cards in organized columns extending from the center strip
- IGNORE all scattered, loose, held, or discarded cards
- COUNT TOTAL CARD EDGES in each column first, then identify numbers, then derive wagers from the math
- A card with a number is ALWAYS a numbered card (2–10)
- A wager card has NO number — only the handshake symbol
- Each value 2–10 appears at most once per color per player
- Max 3 wager cards per color per player
- Report cardValues in ascending order
- Include all board colors for both players (empty columns = totalCardsInColumn:0, wagerCount:0, cardValues:[])
- NEVER assign cards from one side of the center strip to the other player`;

const EXPEDITION_SCHEMA = {
  type: "object" as const,
  properties: {
    color: {
      type: "string" as const,
      enum: ["yellow", "blue", "white", "green", "red", "purple"],
    },
    totalCardsInColumn: { type: "integer" as const },
    wagerCount: { type: "integer" as const },
    cardValues: {
      type: "array" as const,
      items: { type: "integer" as const },
    },
  },
  required: ["color", "totalCardsInColumn", "wagerCount", "cardValues"],
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
            thinkingBudget: 24576,
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
