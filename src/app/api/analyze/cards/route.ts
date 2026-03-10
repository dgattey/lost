import { NextRequest, NextResponse } from "next/server";
import { readCardsFromHalf } from "@/lib/gemini";
import { isRateLimitError } from "@/lib/gemini";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { image, boardColors } = await request.json();

    if (!image || typeof image !== "string" || image.length < 100) {
      return NextResponse.json(
        { error: "Missing or invalid image." },
        { status: 400 }
      );
    }

    if (!Array.isArray(boardColors) || boardColors.length === 0) {
      return NextResponse.json(
        { error: "Missing boardColors." },
        { status: 400 }
      );
    }

    const expeditions = await readCardsFromHalf(image, boardColors);
    return NextResponse.json({ success: true, data: { expeditions } });
  } catch (error) {
    console.error("Card reading error:", error);
    if (isRateLimitError(error)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait and try again." },
        { status: 429 }
      );
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
