import sharp from "sharp";
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

// ---------------------------------------------------------------------------
// Pass 1: Board layout + orientation
// ---------------------------------------------------------------------------

const LAYOUT_PROMPT = `You are analyzing a photo of a Lost Cities card game. Identify the board layout.

Find the **center board strip** — a long, narrow game board piece with colored expedition sections. Cards are played in organized fans on both sides of this strip.

Report:
1. **boardColors**: Which expedition colors appear on the center strip (from the standard set: yellow, blue, white, green, red, purple).
2. **centerLinePercent**: Where is the center strip located? Express as a percentage (0-100) along the axis perpendicular to the strip:
   - If the strip is roughly horizontal: what percentage from the TOP of the image is the center strip? (e.g., 50 means middle)
   - If the strip is roughly vertical: what percentage from the LEFT of the image is the center strip?
3. **orientation**: Is the center strip roughly "horizontal" or "vertical"?

Player 1's cards fan toward the bottom/right of the image. Player 2's cards fan toward the top/left.`;

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
    centerLinePercent: { type: "integer" as const },
    orientation: {
      type: "string" as const,
      enum: ["horizontal", "vertical"],
    },
  },
  required: ["boardColors", "centerLinePercent", "orientation"],
};

interface BoardLayout {
  boardColors: string[];
  centerLinePercent: number;
  orientation: "horizontal" | "vertical";
}

// ---------------------------------------------------------------------------
// Pass 2: Per-player card reading on a cropped half
// ---------------------------------------------------------------------------

function makePlayerPrompt(boardColors: string[]): string {
  const colorList = boardColors.join(", ");
  return `You are reading Lost Cities cards in this cropped image. This image shows ONLY ONE player's side of the board.

The board has these expedition colors: **${colorList}**.

For EACH color, look for an organized fan of cards. If present, read them. If no cards for a color, report it as empty.

For each color with cards:
1. **totalCardsInColumn** — Count physical cards by counting visible card edges/corners. Do NOT count the center strip artwork.
2. **cardValues** — Every visible number (2–10), in ascending order.
3. **wagerCount** — totalCardsInColumn minus count(cardValues). Wager cards have a handshake symbol (NO number) and are closest to the center strip edge.

Rules:
- Each number 2–10 appears at most ONCE per color
- Max 3 wager cards per color
- **9 vs 6**: If cards appear upside-down, a "6" is actually **9**. If a column has 8 and 10 but no 9, look for an upside-down 6.
- Report cardValues in ascending order
- IGNORE scattered/loose cards not in organized fans
- totalCardsInColumn MUST equal wagerCount + count(cardValues)

For colors with no cards: totalCardsInColumn=0, wagerCount=0, cardValues=[].`;
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

// ---------------------------------------------------------------------------
// Retry-with-backoff helper
// ---------------------------------------------------------------------------

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
// Image cropping
// ---------------------------------------------------------------------------

async function cropImageHalves(
  imageBase64: string,
  layout: BoardLayout
): Promise<{ player1Half: string; player2Half: string }> {
  const imgBuffer = Buffer.from(imageBase64, "base64");
  const metadata = await sharp(imgBuffer).metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  const splitPercent = Math.max(20, Math.min(80, layout.centerLinePercent));
  const overlap = 5; // % overlap so cards near the center strip aren't cut off

  let p1Crop: { left: number; top: number; width: number; height: number };
  let p2Crop: { left: number; top: number; width: number; height: number };

  if (layout.orientation === "horizontal") {
    const splitY = Math.round((height * splitPercent) / 100);
    const overlapPx = Math.round((height * overlap) / 100);

    // Player 1 = bottom half (near camera)
    p1Crop = {
      left: 0,
      top: Math.max(0, splitY - overlapPx),
      width,
      height: height - Math.max(0, splitY - overlapPx),
    };
    // Player 2 = top half (far from camera)
    p2Crop = {
      left: 0,
      top: 0,
      width,
      height: Math.min(height, splitY + overlapPx),
    };
  } else {
    const splitX = Math.round((width * splitPercent) / 100);
    const overlapPx = Math.round((width * overlap) / 100);

    // Player 1 = right half
    p1Crop = {
      left: Math.max(0, splitX - overlapPx),
      top: 0,
      width: width - Math.max(0, splitX - overlapPx),
      height,
    };
    // Player 2 = left half
    p2Crop = {
      left: 0,
      top: 0,
      width: Math.min(width, splitX + overlapPx),
      height,
    };
  }

  const [p1Buffer, p2Buffer] = await Promise.all([
    sharp(imgBuffer).extract(p1Crop).jpeg({ quality: 92 }).toBuffer(),
    sharp(imgBuffer).extract(p2Crop).jpeg({ quality: 92 }).toBuffer(),
  ]);

  return {
    player1Half: p1Buffer.toString("base64"),
    player2Half: p2Buffer.toString("base64"),
  };
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze a Lost Cities board photo using a two-pass approach with
 * image cropping:
 *
 * **Pass 1** — Identify the board center strip position and orientation,
 * plus which colors are on the board.
 *
 * **Crop** — Split the image into two halves at the center strip, one
 * per player. Each half only shows that player's cards.
 *
 * **Pass 2** — Two parallel Gemini calls, one per cropped half. Each
 * call reads only the cards visible in its half.
 *
 * All calls use temperature=0 for determinism.
 */
export async function analyzeBoard(
  imageBase64: string
): Promise<ValidatedGameData> {
  const client = getClient();
  const imageData = {
    inlineData: { mimeType: "image/jpeg" as const, data: imageBase64 },
  };

  // --- Pass 1: Board layout + center strip position ---
  console.log("[gemini] Pass 1: Identifying board layout…");
  const layout = await callWithRetry(async () => {
    const res = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: LAYOUT_PROMPT }, imageData] },
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

  console.log(
    `[gemini] Layout: colors=${layout.boardColors.join(",")}, ` +
      `center=${layout.centerLinePercent}%, orientation=${layout.orientation}`
  );

  // --- Crop image into two halves ---
  console.log("[gemini] Cropping image into player halves…");
  const { player1Half, player2Half } = await cropImageHalves(
    imageBase64,
    layout
  );

  // --- Pass 2: Per-player card reading on cropped halves (parallel) ---
  console.log("[gemini] Pass 2: Reading cards per player (parallel)…");

  const prompt = makePlayerPrompt(layout.boardColors);

  async function readPlayer(
    label: string,
    halfBase64: string
  ): Promise<RawPlayerExpedition[]> {
    return callWithRetry(async () => {
      const res = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: halfBase64,
                },
              },
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
      if (!text) throw new Error(`No response from Gemini (${label})`);
      const parsed = JSON.parse(text) as {
        expeditions: RawPlayerExpedition[];
      };

      const problems = findConsistencyProblems(parsed.expeditions);
      if (problems.length > 0) {
        console.log(
          `[gemini] ${label} consistency issues:\n` +
            problems.map((p) => `  - ${p}`).join("\n")
        );
      }

      return parsed.expeditions;
    }, label);
  }

  const [p1Expeditions, p2Expeditions] = await Promise.all([
    readPlayer("Player 1", player1Half),
    readPlayer("Player 2", player2Half),
  ]);

  const raw = {
    player1: { expeditions: p1Expeditions },
    player2: { expeditions: p2Expeditions },
  };

  return analyzedGameSchema.parse(raw);
}
