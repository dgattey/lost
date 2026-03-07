import { NextRequest, NextResponse } from "next/server";
import { analyzeBoard } from "@/lib/gemini";

export const maxDuration = 60; // Allow up to 60s for AI analysis

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

    // Basic sanity check on base64 length (should be reasonable for an image)
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

    // Check for common error types
    if (message.includes("GEMINI_API_KEY")) {
      return NextResponse.json(
        { error: "Server configuration error: API key not set." },
        { status: 500 }
      );
    }

    if (message.includes("RATE_LIMIT") || message.includes("429")) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Analysis failed: ${message}` },
      { status: 500 }
    );
  }
}
