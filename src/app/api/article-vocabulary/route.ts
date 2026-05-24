import { NextRequest } from "next/server";
import { z } from "zod";
import { guardAuthenticatedRequest, noStoreJson } from "@/lib/api-guard";
import { suggestArticleVocabulary } from "@/lib/openai";
import {
  USER_SETTINGS_SELECT,
  coerceUserSettings,
} from "@/lib/user-settings";
import type { UserSettings } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  articleId: z.string().uuid(),
  articleTitle: z.string().trim().min(1, "Please provide the article title."),
  content: z.string().min(1, "Please provide article content."),
});

export async function POST(request: NextRequest) {
  try {
    const guard = await guardAuthenticatedRequest(request, {
      routeId: "article-vocabulary",
      limit: 8,
      windowMs: 60_000,
    });

    if ("response" in guard) {
      return guard.response;
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return noStoreJson(
        { error: parsed.error.issues[0]?.message || "Invalid request body." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return noStoreJson(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const { data: settingsRow } = await guard.supabase
      .from("user_settings")
      .select(USER_SETTINGS_SELECT)
      .eq("user_id", guard.user.id)
      .maybeSingle();
    const settings = coerceUserSettings(settingsRow as Partial<UserSettings> | null);

    const suggestions = await suggestArticleVocabulary({
      articleTitle: parsed.data.articleTitle,
      content: parsed.data.content,
      englishLevel: settings.englishLevel,
    });

    return noStoreJson({ suggestions });
  } catch (error) {
    console.error("Article vocabulary API error:", error);
    return noStoreJson(
      { error: "Could not find useful words for this article right now." },
      { status: 500 }
    );
  }
}
