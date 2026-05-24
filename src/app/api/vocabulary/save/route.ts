import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { noStoreJson, guardAuthenticatedRequest } from "@/lib/api-guard";
import { translateSelection } from "@/lib/openai";
import { normalizeVocabularyEnrichment } from "@/lib/vocabulary-enrichment";
import type { SavedVocabularyPreview, VocabularyLookupResult } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const enrichmentTextItemSchema = z.string().trim().min(1);

const translationSchema = z
  .object({
    text: z.string().trim().min(1),
    thai_meaning: z.string().trim().min(1),
    english_meaning: z.string().trim().min(1),
    part_of_speech: z.string().trim().min(1),
    contextual_meaning: z.string().trim().min(1),
    context_explanation: z.string().trim().min(1),
    difficulty: z.enum(["easy", "medium", "hard"]),
    lemma: z.string().trim().optional(),
    cefr_level: z.enum(["", "A1", "A2", "B1", "B2", "C1", "C2"]).optional(),
    synonyms: z.array(enrichmentTextItemSchema).optional(),
    antonyms: z.array(enrichmentTextItemSchema).optional(),
    word_family: z
      .array(
        z
          .object({
            word: z.string().trim().min(1),
            part_of_speech: z.string().trim().optional(),
            thai_meaning: z.string().trim().optional(),
          })
          .strict()
      )
      .optional(),
    collocations: z
      .array(
        z
          .object({
            phrase: z.string().trim().min(1),
            thai_meaning: z.string().trim().optional(),
            example: z.string().trim().optional(),
          })
          .strict()
      )
      .optional(),
  })
  .strict();

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
  lemma: string;
  cefr_level: string;
  pronunciation: string;
  last_source_name: string;
  context_inserted: boolean;
}

interface SaveVocabularyFallbackRow {
  id: string;
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  difficulty: "easy" | "medium" | "hard";
  lemma: string | null;
  cefr_level: string | null;
  synonyms: string[] | null;
  antonyms: string[] | null;
  word_family: unknown;
  collocations: unknown;
  pronunciation: string | null;
  last_source_name: string | null;
}

function toSavedPreview(row: SaveVocabularyRpcRow | SaveVocabularyFallbackRow): SavedVocabularyPreview {
  return {
    id: row.id,
    word: row.word,
    thai_meaning: row.thai_meaning,
    english_meaning: row.english_meaning,
    part_of_speech: row.part_of_speech,
    difficulty: row.difficulty,
    lemma: row.lemma || undefined,
    cefr_level: row.cefr_level === "A1" ||
      row.cefr_level === "A2" ||
      row.cefr_level === "B1" ||
      row.cefr_level === "B2" ||
      row.cefr_level === "C1" ||
      row.cefr_level === "C2"
      ? row.cefr_level
      : undefined,
    pronunciation: row.pronunciation || row.word,
    last_source_name: row.last_source_name || undefined,
  };
}

async function saveVocabularyFallback({
  supabase,
  userId,
  articleId,
  articleSourceName,
  sentence,
  translation,
}: {
  supabase: SupabaseClient;
  userId: string;
  articleId: string;
  articleSourceName: string;
  sentence: string;
  translation: VocabularyLookupResult;
}) {
  const selectFields =
    "id, word, thai_meaning, english_meaning, part_of_speech, difficulty, lemma, cefr_level, synonyms, antonyms, word_family, collocations, pronunciation, last_source_name";
  const normalizedWord = translation.text.trim();
  const enrichment = normalizeVocabularyEnrichment(translation);

  const { data: existingRows, error: existingError } = await supabase
    .from("vocabulary_items")
    .select(selectFields)
    .eq("user_id", userId)
    .ilike("word", normalizedWord)
    .limit(1);

  if (existingError) {
    throw existingError;
  }

  const existing = (existingRows as SaveVocabularyFallbackRow[] | null)?.[0] ?? null;
  const enrichmentPayload = {
    lemma: enrichment.lemma || existing?.lemma || "",
    cefr_level: enrichment.cefr_level || existing?.cefr_level || "",
    synonyms: enrichment.synonyms.length > 0 ? enrichment.synonyms : existing?.synonyms ?? [],
    antonyms: enrichment.antonyms.length > 0 ? enrichment.antonyms : existing?.antonyms ?? [],
    word_family:
      enrichment.word_family.length > 0 ? enrichment.word_family : existing?.word_family ?? [],
    collocations:
      enrichment.collocations.length > 0 ? enrichment.collocations : existing?.collocations ?? [],
  };

  let item: SaveVocabularyFallbackRow | null = null;
  if (existing) {
    const { data, error } = await supabase
      .from("vocabulary_items")
      .update({
        thai_meaning: translation.thai_meaning,
        english_meaning: translation.english_meaning,
        part_of_speech: translation.part_of_speech,
        difficulty: translation.difficulty,
        ...enrichmentPayload,
        pronunciation: normalizedWord,
        last_source_name: articleSourceName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select(selectFields)
      .single();

    if (error || !data) {
      throw error || new Error("Could not update this vocabulary item.");
    }

    item = data as SaveVocabularyFallbackRow;
  } else {
    const { data, error } = await supabase
      .from("vocabulary_items")
      .insert({
        user_id: userId,
        word: normalizedWord,
        thai_meaning: translation.thai_meaning,
        english_meaning: translation.english_meaning,
        part_of_speech: translation.part_of_speech,
        difficulty: translation.difficulty,
        ...enrichmentPayload,
        pronunciation: normalizedWord,
        last_source_name: articleSourceName,
      })
      .select(selectFields)
      .single();

    if (error || !data) {
      throw error || new Error("Could not create this vocabulary item.");
    }

    item = data as SaveVocabularyFallbackRow;
  }

  const { error: reviewStateError } = await supabase.from("review_states").upsert(
    {
      user_id: userId,
      vocabulary_item_id: item.id,
    },
    { onConflict: "user_id,vocabulary_item_id" }
  );

  if (reviewStateError) {
    throw reviewStateError;
  }

  let contextInserted = false;
  if (sentence.trim()) {
    const { error: contextError } = await supabase.from("vocabulary_contexts").insert({
      vocabulary_item_id: item.id,
      article_id: articleId,
      original_sentence: sentence.trim(),
      contextual_meaning: translation.contextual_meaning,
      context_explanation: translation.context_explanation,
    });

    if (!contextError) {
      contextInserted = true;
    } else if (contextError.code !== "23505") {
      throw contextError;
    }
  }

  return {
    item: toSavedPreview(item),
    contextInserted,
  };
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

    const enrichedTranslationResult: VocabularyLookupResult = {
      ...translationResult,
      ...normalizeVocabularyEnrichment(translationResult),
    };

    const { data, error } = await guard.supabase
      .rpc("save_vocabulary_entry", {
        p_word: enrichedTranslationResult.text.trim(),
        p_thai_meaning: enrichedTranslationResult.thai_meaning,
        p_english_meaning: enrichedTranslationResult.english_meaning,
        p_part_of_speech: enrichedTranslationResult.part_of_speech,
        p_difficulty: enrichedTranslationResult.difficulty,
        p_pronunciation: enrichedTranslationResult.text.trim(),
        p_last_source_name: parsed.data.articleSourceName,
        p_article_id: parsed.data.articleId,
        p_original_sentence: parsed.data.sentence,
        p_contextual_meaning: enrichedTranslationResult.contextual_meaning,
        p_context_explanation: enrichedTranslationResult.context_explanation,
        p_lemma: enrichedTranslationResult.lemma,
        p_cefr_level: enrichedTranslationResult.cefr_level,
        p_synonyms: enrichedTranslationResult.synonyms,
        p_antonyms: enrichedTranslationResult.antonyms,
        p_word_family: enrichedTranslationResult.word_family,
        p_collocations: enrichedTranslationResult.collocations,
      })
      .single<SaveVocabularyRpcRow>();

    if (!error && data) {
      return noStoreJson({
        item: toSavedPreview(data),
        lookup: enrichedTranslationResult,
        contextInserted: data.context_inserted,
      });
    }

    const fallback = await saveVocabularyFallback({
      supabase: guard.supabase,
      userId: guard.user.id,
      articleId: parsed.data.articleId,
      articleSourceName: parsed.data.articleSourceName,
      sentence: parsed.data.sentence,
      translation: enrichedTranslationResult,
    });

    return noStoreJson({
      item: fallback.item,
      lookup: enrichedTranslationResult,
      contextInserted: fallback.contextInserted,
    });
  } catch (error) {
    console.error("Vocabulary save API error:", error);
    return noStoreJson(
      { error: "Could not save this word right now." },
      { status: 500 }
    );
  }
}
