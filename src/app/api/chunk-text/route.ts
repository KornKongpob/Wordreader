import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chunkArticleText } from "@/lib/openai";

const requestSchema = z.object({
  content: z.string().min(1, "Please provide article HTML content."),
  articleTitle: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request body." },
        { status: 400 }
      );
    }

    const result = await chunkArticleText(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Chunk text API error:", error);
    return NextResponse.json(
      { error: "Could not prepare chunked reading help right now." },
      { status: 500 }
    );
  }
}
