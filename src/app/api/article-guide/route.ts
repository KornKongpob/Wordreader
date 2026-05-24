import { NextRequest } from "next/server";
import { z } from "zod";
import { guardAuthenticatedRequest, noStoreJson } from "@/lib/api-guard";
import {
  getArticleArtifact,
  upsertArticleArtifact,
} from "@/lib/ai-artifacts";
import {
  createArticleGuideInputHash,
  isArticleGuidePayload,
} from "@/lib/article-guide";
import { generateArticleGuide, OPENAI_MODEL } from "@/lib/openai";
import {
  USER_SETTINGS_SELECT,
  coerceUserSettings,
} from "@/lib/user-settings";
import type { ArticleGuide, UserSettings } from "@/types";

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
      routeId: "article-guide",
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

    const { data: settingsRow } = await guard.supabase
      .from("user_settings")
      .select(USER_SETTINGS_SELECT)
      .eq("user_id", guard.user.id)
      .maybeSingle();
    const settings = coerceUserSettings(settingsRow as Partial<UserSettings> | null);
    const inputHash = createArticleGuideInputHash({
      content: parsed.data.content,
      englishLevel: settings.englishLevel,
      learningGoal: settings.learningGoal,
      translationDensity: settings.translationDensity,
    });

    const cached = await getArticleArtifact<ArticleGuide>({
      supabase: guard.supabase,
      userId: guard.user.id,
      articleId: parsed.data.articleId,
      artifactType: "article_guide",
      inputHash,
    });

    if (isArticleGuidePayload(cached)) {
      return noStoreJson({ guide: cached });
    }

    if (!process.env.OPENAI_API_KEY) {
      return noStoreJson(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const guide = await generateArticleGuide({
      articleTitle: parsed.data.articleTitle,
      content: parsed.data.content,
      englishLevel: settings.englishLevel,
      learningGoal: settings.learningGoal,
      translationDensity: settings.translationDensity,
    });

    await upsertArticleArtifact({
      supabase: guard.supabase,
      userId: guard.user.id,
      articleId: parsed.data.articleId,
      artifactType: "article_guide",
      inputHash,
      model: OPENAI_MODEL,
      payload: guide,
    });

    return noStoreJson({ guide });
  } catch (error) {
    console.error("Article guide API error:", error);
    return noStoreJson(
      { error: "Could not prepare this article guide right now." },
      { status: 500 }
    );
  }
}
