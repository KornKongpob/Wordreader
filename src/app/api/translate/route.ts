import { NextRequest, NextResponse } from "next/server";
import { translateWord } from "@/lib/openai";

export async function POST(request: NextRequest) {
  try {
    const { word, sentence, articleTitle } = await request.json();

    if (!word || typeof word !== "string") {
      return NextResponse.json(
        { error: "Please provide a word or phrase." },
        { status: 400 }
      );
    }

    if (!sentence || typeof sentence !== "string") {
      return NextResponse.json(
        { error: "Please provide the sentence context." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const result = await translateWord({
      word: word.trim(),
      sentence: sentence.trim(),
      articleTitle: articleTitle?.trim() || "Unknown article",
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
