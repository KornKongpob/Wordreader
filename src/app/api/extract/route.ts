import { NextRequest } from "next/server";
import { guardAuthenticatedRequest, noStoreJson } from "@/lib/api-guard";
import { extractArticle } from "@/lib/extractor";

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

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return noStoreJson(
        { error: "That doesn't look like a valid URL." },
        { status: 400 }
      );
    }

    const article = await extractArticle(url);

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
