import { normalizeLookupText } from "@/lib/lookup";
import type {
  ArticleVocabularySuggestion,
  VocabularyCefrLevel,
  VocabularyLookupResult,
} from "@/types";

const CEFR_LEVELS = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);
const DIFFICULTY_LEVELS = new Set(["easy", "medium", "hard"]);
const MAX_SUGGESTIONS = 12;

interface SavePayloadInput {
  articleId: string;
  articleTitle: string;
  articleSourceName: string;
  suggestion: ArticleVocabularySuggestion;
}

function trimText(value: unknown) {
  return typeof value === "string" ? normalizeLookupText(value) : "";
}

function normalizeCefrLevel(value: unknown): VocabularyCefrLevel {
  const level = trimText(value).toUpperCase();
  return CEFR_LEVELS.has(level) ? (level as VocabularyCefrLevel) : "";
}

function normalizeDifficulty(value: unknown): ArticleVocabularySuggestion["difficulty"] {
  const difficulty = trimText(value).toLowerCase();
  return DIFFICULTY_LEVELS.has(difficulty)
    ? (difficulty as ArticleVocabularySuggestion["difficulty"])
    : "medium";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getArticleVocabularyKey(value: string) {
  return normalizeLookupText(value).toLowerCase();
}

export function normalizeArticleVocabularySuggestions(
  input: unknown
): ArticleVocabularySuggestion[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const seen = new Set<string>();
  const suggestions: ArticleVocabularySuggestion[] = [];

  for (const rawItem of input) {
    if (!isRecord(rawItem)) {
      continue;
    }

    const word = trimText(rawItem.word);
    const key = getArticleVocabularyKey(word);
    const item = {
      word,
      lemma: trimText(rawItem.lemma),
      thai_meaning: trimText(rawItem.thai_meaning),
      english_meaning: trimText(rawItem.english_meaning),
      part_of_speech: trimText(rawItem.part_of_speech),
      cefr_level: normalizeCefrLevel(rawItem.cefr_level),
      difficulty: normalizeDifficulty(rawItem.difficulty),
      original_sentence: trimText(rawItem.original_sentence),
      why_useful_th: trimText(rawItem.why_useful_th),
    };

    if (
      !item.word ||
      !item.thai_meaning ||
      !item.english_meaning ||
      !item.part_of_speech ||
      !item.original_sentence ||
      !item.why_useful_th ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    suggestions.push(item);

    if (suggestions.length >= MAX_SUGGESTIONS) {
      break;
    }
  }

  return suggestions;
}

export function createArticleVocabularySavePayload({
  articleId,
  articleTitle,
  articleSourceName,
  suggestion,
}: SavePayloadInput) {
  const translation: VocabularyLookupResult = {
    type: "vocab",
    intent: "translate",
    text: suggestion.word,
    thai_meaning: suggestion.thai_meaning,
    english_meaning: suggestion.english_meaning,
    part_of_speech: suggestion.part_of_speech,
    contextual_meaning: suggestion.thai_meaning,
    context_explanation: suggestion.why_useful_th,
    difficulty: suggestion.difficulty,
    lemma: suggestion.lemma,
    cefr_level: suggestion.cefr_level,
  };

  return {
    articleId,
    articleTitle,
    articleSourceName,
    text: suggestion.word,
    sentence: suggestion.original_sentence,
    paragraph: suggestion.original_sentence,
    translation,
  };
}
