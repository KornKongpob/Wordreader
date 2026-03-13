import { NextRequest } from "next/server";
import { z } from "zod";
import { noStoreJson, guardAuthenticatedRequest } from "@/lib/api-guard";
import { translateSelection } from "@/lib/openai";
import type { SavedVocabularyPreview, VocabularyLookupResult } from "@/types";

const translationSchema = z.object({
  text: z.string().trim().min(1),
  thai_meaning: z.string().trim().min(1),
  english_meaning: z.string().trim().min(1),
  part_of_speech: z.string().trim().min(1),
  contextual_meaning: z.string().trim().min(1),
  context_explanation: z.string().trim().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

const requestSchema = z.object({
  articleId: z.string().uuid(),
  articleTitle: z.string().trim().min(1),
  articleSourceName: z.string().trim().min(1),
  text: z.string().trim().min(1),
  sentence: z.string().trim().min(1),
  paragraph: z.string().trim().min(1),
  translation: translationSchema.optional(),
});

interface SaveVocabularyRpcRow {
  id: string;
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  difficulty: "easy" | "medium" | "hard";
  pronunciation: string;
  last_source_name: string;
  context_inserted: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardAuthenticatedRequest(request, {
      routeId: "vocabulary-save",
      limit: 20,
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

    const translationResult = parsed.data.translation
      ? ({
          type: "vocab",
          intent: "translate",
          ...parsed.data.translation,
        } satisfies VocabularyLookupResult)
      : await translateSelection({
          text: parsed.data.text,
          sentence: parsed.data.sentence,
          paragraph: parsed.data.paragraph,
          articleTitle: parsed.data.articleTitle,
          mode: "vocab",
          intent: "translate",
        });

    if (translationResult.type !== "vocab") {
      return noStoreJson(
        { error: "Could not prepare vocabulary details for this selection." },
        { status: 422 }
      );
    }

    const { data, error } = await guard.supabase
      .rpc("save_vocabulary_entry", {
        p_word: translationResult.text.trim(),
        p_thai_meaning: translationResult.thai_meaning,
        p_english_meaning: translationResult.english_meaning,
        p_part_of_speech: translationResult.part_of_speech,
        p_difficulty: translationResult.difficulty,
        p_pronunciation: translationResult.text.trim(),
        p_last_source_name: parsed.data.articleSourceName,
        p_article_id: parsed.data.articleId,
        p_original_sentence: parsed.data.sentence,
        p_contextual_meaning: translationResult.contextual_meaning,
        p_context_explanation: translationResult.context_explanation,
      })
      .single<SaveVocabularyRpcRow>();

    if (error || !data) {
      return noStoreJson(
        { error: error?.message || "Could not save this word right now." },
        { status: 500 }
      );
    }

    const item: SavedVocabularyPreview = {
      id: data.id,
      word: data.word,
      thai_meaning: data.thai_meaning,
      english_meaning: data.english_meaning,
      part_of_speech: data.part_of_speech,
      difficulty: data.difficulty,
      pronunciation: data.pronunciation,
      last_source_name: data.last_source_name,
    };

    return noStoreJson({
      item,
      lookup: translationResult,
      contextInserted: data.context_inserted,
    });
  } catch (error) {
    console.error("Vocabulary save API error:", error);
    return noStoreJson(
      { error: "Could not save this word right now." },
      { status: 500 }
    );
  }
}
