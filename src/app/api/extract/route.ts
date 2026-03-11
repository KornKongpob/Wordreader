import { NextRequest, NextResponse } from "next/server";
import { extractArticle } from "@/lib/extractor";

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

    const article = await extractArticle(url);

    if (!article) {
      return NextResponse.json(
        { error: "Could not extract this article right now. Try another article URL." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      article,
    });
  } catch (error) {
    console.error("Extract API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
