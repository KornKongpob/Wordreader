import { NextRequest } from "next/server";
import { z } from "zod";
import { guardAuthenticatedRequest, noStoreJson } from "@/lib/api-guard";
import {
  getArticleArtifact,
  hashArticleInput,
  upsertArticleArtifact,
} from "@/lib/ai-artifacts";
import { detectIdioms, OPENAI_MODEL } from "@/lib/openai";
import type { DetectedIdiom } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  content: z.string().min(1, "Please provide article HTML content."),
  articleTitle: z.string().trim().optional(),
  articleId: z.string().uuid().optional(),
});

function isDetectedIdioms(value: unknown): value is DetectedIdiom[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "phrase" in item &&
        "meaning" in item &&
        "type" in item &&
        typeof item.phrase === "string" &&
        typeof item.meaning === "string" &&
        (item.type === "idiom" || item.type === "phrasal_verb")
    )
  );
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardAuthenticatedRequest(request, {
      routeId: "detect-idioms",
      limit: 12,
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

    const cacheContext = parsed.data.articleId
      ? {
          articleId: parsed.data.articleId,
          inputHash: hashArticleInput(parsed.data.content),
        }
      : null;

    if (cacheContext) {
      const cached = await getArticleArtifact<DetectedIdiom[]>({
        supabase: guard.supabase,
        userId: guard.user.id,
        articleId: cacheContext.articleId,
        artifactType: "idioms",
        inputHash: cacheContext.inputHash,
      });

      if (cached && isDetectedIdioms(cached)) {
        return noStoreJson(cached);
      }
    }

    if (!process.env.OPENAI_API_KEY) {
      return noStoreJson(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const result = await detectIdioms(parsed.data);

    if (cacheContext) {
      await upsertArticleArtifact({
        supabase: guard.supabase,
        userId: guard.user.id,
        articleId: cacheContext.articleId,
        artifactType: "idioms",
        inputHash: cacheContext.inputHash,
        model: OPENAI_MODEL,
        payload: result,
      });
    }

    return noStoreJson(result);
  } catch (error) {
    console.error("Detect idioms API error:", error);
    return noStoreJson(
      { error: "Could not detect idioms right now." },
      { status: 500 }
    );
  }
}
