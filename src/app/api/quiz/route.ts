import { NextRequest, NextResponse } from "next/server";
import { generateArticleQuiz } from "@/lib/openai";

export async function POST(request: NextRequest) {
  try {
    const { articleTitle, content } = await request.json();

    if (!articleTitle || typeof articleTitle !== "string") {
      return NextResponse.json(
        { error: "Please provide the article title." },
        { status: 400 }
      );
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Please provide article content." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const questions = await generateArticleQuiz({ articleTitle, content });
    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Quiz API error:", error);
    return NextResponse.json(
      { error: "Could not generate a quiz right now." },
      { status: 500 }
    );
  }
}
