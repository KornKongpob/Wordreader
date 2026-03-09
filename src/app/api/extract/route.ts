import { NextRequest, NextResponse } from "next/server";
import { extractArticle, isCNNUrl } from "@/lib/extractor";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Please provide a valid URL." },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "That doesn't look like a valid URL." },
        { status: 400 }
      );
    }

    // For MVP, warn if not CNN but still try extraction
    const isCNN = isCNNUrl(url);

    const article = await extractArticle(url);

    if (!article) {
      return NextResponse.json(
        {
          error: isCNN
            ? "Could not extract this CNN article. The page might be a video-only page or use a format we can't read yet."
            : "Could not extract this article. For best results, try a CNN article URL.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      article,
      isCNN,
    });
  } catch (error) {
    console.error("Extract API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
