import { GoogleGenAI, ApiError } from "@google/genai";
import {
  analyzedGameSchema,
  type ValidatedGameData,
  type RawPlayerExpedition,
} from "./validation";

const MAX_RATE_LIMIT_RETRIES = 3;
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
        attempts: 1,
      },
    },
  });
  return _client;
}

export function isRateLimitError(error: unknown): boolean {
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

async function callWithRetry<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      const jitter = backoff * (0.75 + Math.random() * 0.5);
      console.log(
        `[${label}] Rate-limited – retrying in ${Math.round(jitter / 1000)}s ` +
          `(attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES + 1})`
      );
      await sleep(jitter);
    }
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error)) throw error;
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Layout detection (Pass 1)
// ---------------------------------------------------------------------------

const LAYOUT_PROMPT = `You are analyzing a top-down photo of a Lost Cities card game board.

Find the **center board strip** — a long, narrow game board piece with colored expedition sections. Cards are played in organized fans on both sides of this strip.

Report:
1. **boardColors**: Which expedition colors are on the center strip (from: yellow, blue, white, green, red, purple).

2. **splitAxis**: Which axis separates the two players' cards?
   - "x" — the strip runs top-to-bottom, so split with a vertical line (left vs right halves)
   - "y" — the strip runs left-to-right, so split with a horizontal line (top vs bottom halves)
   Pick whichever axis best separates the two players' card fans.

3. **splitPercent**: Where along that axis is the center of the strip? (0–100)
   - If splitAxis="x": percentage from the LEFT edge
   - If splitAxis="y": percentage from the TOP edge`;

const LAYOUT_SCHEMA = {
  type: "object" as const,
  properties: {
    boardColors: {
      type: "array" as const,
      items: {
        type: "string" as const,
        enum: ["yellow", "blue", "white", "green", "red", "purple"],
      },
    },
    splitAxis: {
      type: "string" as const,
      enum: ["x", "y"],
    },
    splitPercent: { type: "integer" as const },
  },
  required: ["boardColors", "splitAxis", "splitPercent"],
};

export interface BoardLayout {
  boardColors: string[];
  splitAxis: "x" | "y";
  splitPercent: number;
}

export async function detectLayout(
  imageBase64: string
): Promise<BoardLayout> {
  const client = getClient();
  return callWithRetry(async () => {
    const res = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: LAYOUT_PROMPT },
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
          ],
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: LAYOUT_SCHEMA,
        thinkingConfig: { thinkingBudget: 4096 },
      },
    });
    const text = res.text;
    if (!text) throw new Error("No response from Gemini (layout)");
    return JSON.parse(text) as BoardLayout;
  }, "layout");
}

// ---------------------------------------------------------------------------
// Card reading (Pass 2) — called once per cropped half
// ---------------------------------------------------------------------------

function makePlayerPrompt(boardColors: string[]): string {
  const colorList = boardColors.join(", ");
  return `You are reading Lost Cities cards in this cropped image. This image shows ONLY ONE player's side of the board.

The board has these expedition colors: **${colorList}**.

For EACH color, look for an organized fan of cards extending from the center strip edge. If present, read them. If no organized fan for a color, report it as empty.

## How to read each column

For each color with an organized fan of cards:
1. **totalCardsInColumn** — Count physical cards by counting visible card edges/corners. Do NOT count the center strip artwork.
2. **cardValues** — Every visible number (2–10), in ascending order.
3. **wagerCount** — totalCardsInColumn minus count(cardValues). Wager cards have a handshake symbol (NO number) and are closest to the center strip edge.

## Critical rules
- Each number 2–10 appears at most ONCE per color
- Max 3 wager cards per color
- **9 vs 6**: If cards appear upside-down, a "6" is actually **9**. If a column has 8 and 10 but no 9, look for an upside-down 6.
- Report cardValues in ascending order
- **IGNORE scattered/loose cards** not in organized fans extending from the center strip. Cards lying alone or in piles away from the center strip are NOT played cards.
- totalCardsInColumn MUST equal wagerCount + count(cardValues)

For colors with no organized fan: totalCardsInColumn=0, wagerCount=0, cardValues=[].`;
}

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

const PLAYER_RESPONSE_SCHEMA = {
  type: "object" as const,
  properties: {
    expeditions: { type: "array" as const, items: EXPEDITION_SCHEMA },
  },
  required: ["expeditions"],
};

export async function readCardsFromHalf(
  halfImageBase64: string,
  boardColors: string[]
): Promise<RawPlayerExpedition[]> {
  const client = getClient();
  const prompt = makePlayerPrompt(boardColors);

  return callWithRetry(async () => {
    const res = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: halfImageBase64 } },
          ],
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: PLAYER_RESPONSE_SCHEMA,
        thinkingConfig: { thinkingBudget: 16384 },
      },
    });
    const text = res.text;
    if (!text) throw new Error("No response from Gemini (cards)");
    const parsed = JSON.parse(text) as {
      expeditions: RawPlayerExpedition[];
    };

    const problems = findConsistencyProblems(parsed.expeditions);
    if (problems.length > 0) {
      console.log(
        `[gemini] Card reading consistency issues:\n` +
          problems.map((p) => `  - ${p}`).join("\n")
      );
    }

    return parsed.expeditions;
  }, "cards");
}

// ---------------------------------------------------------------------------
// Consistency checking
// ---------------------------------------------------------------------------

export function findConsistencyProblems(
  expeditions: RawPlayerExpedition[]
): string[] {
  const problems: string[] = [];
  for (const exp of expeditions) {
    const numCards = exp.cardValues.length;
    if (exp.wagerCount < 0 || exp.wagerCount > 3) {
      problems.push(
        `${exp.color}: wagerCount=${exp.wagerCount} out of range 0-3`
      );
    }
    if (exp.totalCardsInColumn !== exp.wagerCount + numCards) {
      problems.push(
        `${exp.color}: totalCards=${exp.totalCardsInColumn} != wager(${exp.wagerCount}) + numbered(${numCards})`
      );
    }
    const unique = new Set(exp.cardValues);
    if (unique.size !== numCards) {
      problems.push(`${exp.color}: duplicate card values [${exp.cardValues}]`);
    }
    for (const v of exp.cardValues) {
      if (v < 2 || v > 10) {
        problems.push(`${exp.color}: card value ${v} out of range 2-10`);
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Validation (re-export for convenience)
// ---------------------------------------------------------------------------

export { analyzedGameSchema, type ValidatedGameData };
