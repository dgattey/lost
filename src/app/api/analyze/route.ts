import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@google/genai";
import { analyzeBoard } from "@/lib/gemini";

export const maxDuration = 60; // Vercel Hobby plan maximum

/**
 * Try to pull a human-readable quota identifier out of the Gemini error body
 * so the user knows which limit they hit (RPM vs RPD vs TPM).
 */
function extractQuotaDetail(errorMessage: string): string {
  try {
    const body = JSON.parse(errorMessage);
    const details: Array<{ violations?: Array<{ quotaId?: string }> }> =
      body?.error?.details ?? body?.details ?? [];
    for (const d of details) {
      const quotaId = d?.violations?.[0]?.quotaId;
      if (quotaId) {
        if (quotaId.includes("PerDay")) return " Daily request quota exhausted.";
        if (quotaId.includes("PerMinute"))
          return " Per-minute request quota exceeded.";
        return ` Quota: ${quotaId}.`;
      }
    }
  } catch {
    // message wasn't JSON — that's fine
  }
  return "";
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image } = body;

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'image' field. Expected a base64 string." },
        { status: 400 }
      );
    }

    if (image.length < 100) {
      return NextResponse.json(
        { error: "Image data too small to be valid." },
        { status: 400 }
      );
    }

    if (image.length > 10_000_000) {
      return NextResponse.json(
        { error: "Image too large. Please use a smaller image (under 7MB)." },
        { status: 400 }
      );
    }

    const gameData = await analyzeBoard(image);

    return NextResponse.json({ success: true, data: gameData });
  } catch (error) {
    console.error("Analysis error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    if (message.includes("GEMINI_API_KEY")) {
      return NextResponse.json(
        { error: "Server configuration error: API key not set." },
        { status: 500 }
      );
    }

    if (isRateLimitError(error)) {
      const detail = extractQuotaDetail(message);
      return NextResponse.json(
        {
          error: `Gemini API rate limit exceeded after retries.${detail} Please wait a moment and try again.`,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Analysis failed: ${message}` },
      { status: 500 }
    );
  }
}
