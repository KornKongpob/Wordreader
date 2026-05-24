import { NextRequest } from "next/server";
import { z } from "zod";
import { guardAuthenticatedRequest, noStoreJson } from "@/lib/api-guard";
import {
  getArticleArtifact,
  hashArticleInput,
  upsertArticleArtifact,
} from "@/lib/ai-artifacts";
import { chunkArticleText, OPENAI_MODEL } from "@/lib/openai";
import type { ChunkedArticleResult } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  content: z.string().min(1, "Please provide article HTML content."),
  articleTitle: z.string().trim().optional(),
  articleId: z.string().uuid().optional(),
});

function isChunkedArticleResult(value: unknown): value is ChunkedArticleResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "html" in value &&
    typeof value.html === "string" &&
    value.html.trim().length > 0
  );
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardAuthenticatedRequest(request, {
      routeId: "chunk-text",
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
      const cached = await getArticleArtifact<ChunkedArticleResult>({
        supabase: guard.supabase,
        userId: guard.user.id,
        articleId: cacheContext.articleId,
        artifactType: "chunked_html",
        inputHash: cacheContext.inputHash,
      });

      if (cached && isChunkedArticleResult(cached)) {
        return noStoreJson(cached);
      }
    }

    if (!process.env.OPENAI_API_KEY) {
      return noStoreJson(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const result = await chunkArticleText(parsed.data);

    if (cacheContext) {
      await upsertArticleArtifact({
        supabase: guard.supabase,
        userId: guard.user.id,
        articleId: cacheContext.articleId,
        artifactType: "chunked_html",
        inputHash: cacheContext.inputHash,
        model: OPENAI_MODEL,
        payload: result,
      });
    }

    return noStoreJson(result);
  } catch (error) {
    console.error("Chunk text API error:", error);
    return noStoreJson(
      { error: "Could not prepare chunked reading help right now." },
      { status: 500 }
    );
  }
}
