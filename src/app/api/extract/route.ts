import { NextRequest } from "next/server";
import { guardAuthenticatedRequest, noStoreJson } from "@/lib/api-guard";
import { extractArticle } from "@/lib/extractor";
import { validatePublicArticleUrl } from "@/lib/safe-url";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const guard = await guardAuthenticatedRequest(request, {
      routeId: "extract",
      limit: 10,
      windowMs: 60_000,
    });

    if ("response" in guard) {
      return guard.response;
    }

    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return noStoreJson(
        { error: "Please provide a valid URL." },
        { status: 400 }
      );
    }

    const validation = await validatePublicArticleUrl(url);
    if (!validation.ok) {
      return noStoreJson({ error: validation.error }, { status: 400 });
    }

    const article = await extractArticle(validation.url);

    if (!article) {
      return noStoreJson(
        { error: "Could not extract this article right now. Try another article URL." },
        { status: 422 }
      );
    }

    return noStoreJson({
      article,
    });
  } catch (error) {
    console.error("Extract API error:", error);
    return noStoreJson(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
