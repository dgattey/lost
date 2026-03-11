import { NextRequest, NextResponse } from "next/server";
import { detectLayout } from "@/lib/gemini";
import { isRateLimitError } from "@/lib/gemini";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image || typeof image !== "string" || image.length < 100) {
      return NextResponse.json(
        { error: "Missing or invalid image." },
        { status: 400 }
      );
    }

    const layout = await detectLayout(image);
    return NextResponse.json({ success: true, data: layout });
  } catch (error) {
    console.error("Layout detection error:", error);
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
