import { NextRequest } from "next/server";
import { guardAuthenticatedRequest, noStoreJson } from "@/lib/api-guard";
import { translateSelection } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const guard = await guardAuthenticatedRequest(request, {
      routeId: "translate",
      limit: 30,
      windowMs: 60_000,
    });

    if ("response" in guard) {
      return guard.response;
    }

    const { text, sentence, paragraph, articleTitle, mode, intent } = await request.json();

    if (!text || typeof text !== "string") {
      return noStoreJson(
        { error: "Please provide text to translate." },
        { status: 400 }
      );
    }

    if (!sentence || typeof sentence !== "string") {
      return noStoreJson(
        { error: "Please provide the sentence context." },
        { status: 400 }
      );
    }

    if (!paragraph || typeof paragraph !== "string") {
      return noStoreJson(
        { error: "Please provide the paragraph context." },
        { status: 400 }
      );
    }

    if (mode !== "vocab" && mode !== "sentence" && mode !== "paragraph") {
      return noStoreJson(
        { error: "Please provide a valid lookup mode." },
        { status: 400 }
      );
    }

    if (intent !== "translate" && intent !== "explain") {
      return noStoreJson(
        { error: "Please provide a valid lookup intent." },
        { status: 400 }
      );
    }

    if (mode === "vocab" && intent !== "translate") {
      return noStoreJson(
        { error: "Explain is only available for sentence and paragraph lookups." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return noStoreJson(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const result = await translateSelection({
      text: text.trim(),
      sentence: sentence.trim(),
      paragraph: paragraph.trim(),
      articleTitle: articleTitle?.trim() || "Unknown article",
      mode,
      intent,
    });

    return noStoreJson(result);
  } catch (error) {
    console.error("Translate API error:", error);
    return noStoreJson(
      { error: "Translation failed. Please try again." },
      { status: 500 }
    );
  }
}
