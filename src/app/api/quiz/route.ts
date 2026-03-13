import { NextRequest } from "next/server";
import { guardAuthenticatedRequest, noStoreJson } from "@/lib/api-guard";
import { generateArticleQuiz } from "@/lib/openai";

export async function POST(request: NextRequest) {
  try {
    const guard = await guardAuthenticatedRequest(request, {
      routeId: "quiz",
      limit: 10,
      windowMs: 60_000,
    });

    if ("response" in guard) {
      return guard.response;
    }

    const { articleTitle, content } = await request.json();

    if (!articleTitle || typeof articleTitle !== "string") {
      return noStoreJson(
        { error: "Please provide the article title." },
        { status: 400 }
      );
    }

    if (!content || typeof content !== "string") {
      return noStoreJson(
        { error: "Please provide article content." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return noStoreJson(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const questions = await generateArticleQuiz({ articleTitle, content });
    return noStoreJson({ questions });
  } catch (error) {
    console.error("Quiz API error:", error);
    return noStoreJson(
      { error: "Could not generate a quiz right now." },
      { status: 500 }
    );
  }
}
