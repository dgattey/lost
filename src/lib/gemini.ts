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
      timeout: 30_000,
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

const ANALYSIS_PROMPT = `You are analyzing a photo of the Lost Cities card game board.

The board shows two players' expeditions arranged by color columns. Each player has their own side of the board. The 5 standard expedition colors are: yellow, blue, white, green, and red. Some boards have a 6th color: purple.

For each player and each expedition color visible on the board:
- Count the number of wager/investment cards (cards showing a handshake symbol with NO number)
- List all the numbered card values (numbers 2 through 10)

Rules for identification:
- Wager cards have a handshake/investment symbol and NO number on them
- Numbered cards show a clear number from 2 to 10
- Cards are overlapped in columns so you can see all the numbers
- Player 1 is on the bottom/near side of the board (closest to camera)
- Player 2 is on the top/far side of the board
- If an expedition has no cards played, set wagerCount to 0 and cardValues to an empty array
- List card values in ascending order

Include all 5 colors (yellow, blue, white, green, red) for each player. If you see a 6th color (purple), include it too.`;

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
 * Uses gemini-2.5-flash-lite for its higher free-tier quota (15 RPM,
 * 1 000 RPD) and retries with exponential backoff (10 s → 20 s → 40 s)
 * so that 429 rate-limit windows have time to clear without burning
 * daily quota.
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
        model: "gemini-2.5-flash-lite",
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
