import { NextRequest } from "next/server";
import { z } from "zod";
import { guardAuthenticatedRequest, noStoreJson } from "@/lib/api-guard";
import { chunkArticleText } from "@/lib/openai";

const requestSchema = z.object({
  content: z.string().min(1, "Please provide article HTML content."),
  articleTitle: z.string().trim().optional(),
});

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

    if (!process.env.OPENAI_API_KEY) {
      return noStoreJson(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return noStoreJson(
        { error: parsed.error.issues[0]?.message || "Invalid request body." },
        { status: 400 }
      );
    }

    const result = await chunkArticleText(parsed.data);
    return noStoreJson(result);
  } catch (error) {
    console.error("Chunk text API error:", error);
    return noStoreJson(
      { error: "Could not prepare chunked reading help right now." },
      { status: 500 }
    );
  }
}
