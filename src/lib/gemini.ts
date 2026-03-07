import { GoogleGenAI } from "@google/genai";
import { analyzedGameSchema, type ValidatedGameData } from "./validation";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }
  return new GoogleGenAI({ apiKey });
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

/**
 * Analyze a Lost Cities board photo using Google Gemini Vision.
 * Returns structured game data with both players' expeditions.
 */
export async function analyzeBoard(
  imageBase64: string
): Promise<ValidatedGameData> {
  const client = getClient();

  const response = await client.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: ANALYSIS_PROMPT },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBase64,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object" as const,
        properties: {
          player1: {
            type: "object" as const,
            properties: {
              expeditions: {
                type: "array" as const,
                items: {
                  type: "object" as const,
                  properties: {
                    color: {
                      type: "string" as const,
                      enum: [
                        "yellow",
                        "blue",
                        "white",
                        "green",
                        "red",
                        "purple",
                      ],
                    },
                    wagerCount: { type: "integer" as const },
                    cardValues: {
                      type: "array" as const,
                      items: { type: "integer" as const },
                    },
                  },
                  required: ["color", "wagerCount", "cardValues"],
                },
              },
            },
            required: ["expeditions"],
          },
          player2: {
            type: "object" as const,
            properties: {
              expeditions: {
                type: "array" as const,
                items: {
                  type: "object" as const,
                  properties: {
                    color: {
                      type: "string" as const,
                      enum: [
                        "yellow",
                        "blue",
                        "white",
                        "green",
                        "red",
                        "purple",
                      ],
                    },
                    wagerCount: { type: "integer" as const },
                    cardValues: {
                      type: "array" as const,
                      items: { type: "integer" as const },
                    },
                  },
                  required: ["color", "wagerCount", "cardValues"],
                },
              },
            },
            required: ["expeditions"],
          },
        },
        required: ["player1", "player2"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response from Gemini");
  }

  const parsed = JSON.parse(text);
  return analyzedGameSchema.parse(parsed);
}
