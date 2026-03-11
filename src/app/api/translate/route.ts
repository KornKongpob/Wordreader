import { NextRequest, NextResponse } from "next/server";
import { translateSelection } from "@/lib/openai";

export async function POST(request: NextRequest) {
  try {
    const { text, sentence, articleTitle, mode } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Please provide text to translate." },
        { status: 400 }
      );
    }

    if (!sentence || typeof sentence !== "string") {
      return NextResponse.json(
        { error: "Please provide the sentence context." },
        { status: 400 }
      );
    }

    if (mode !== "vocab" && mode !== "sentence") {
      return NextResponse.json(
        { error: "Please provide a valid lookup mode." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const result = await translateSelection({
      text: text.trim(),
      sentence: sentence.trim(),
      articleTitle: articleTitle?.trim() || "Unknown article",
      mode,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Translate API error:", error);
    return NextResponse.json(
      { error: "Translation failed. Please try again." },
      { status: 500 }
    );
  }
}
