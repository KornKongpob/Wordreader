import { NextRequest, NextResponse } from "next/server";
import { fetchNewsFeed } from "@/lib/news";
import type { NewsSection } from "@/types";

export const runtime = "nodejs";

function normalizeSection(value: string | null): NewsSection | "all" {
  return value === "general" ||
    value === "business" ||
    value === "tech" ||
    value === "science"
    ? value
    : "all";
}

export async function GET(request: NextRequest) {
  try {
    const section = normalizeSection(request.nextUrl.searchParams.get("section"));
    const { items, warnings } = await fetchNewsFeed(section);

    return NextResponse.json(
      {
        section,
        items,
        warnings,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=900, stale-while-revalidate=1800",
        },
      }
    );
  } catch (error) {
    console.error("News API error:", error);
    return NextResponse.json(
      { error: "Could not load the latest news right now." },
      { status: 500 }
    );
  }
}
