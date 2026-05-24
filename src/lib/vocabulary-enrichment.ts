import type {
  VocabularyCefrLevel,
  VocabularyCollocationItem,
  VocabularyEnrichment,
  VocabularyLookupResult,
  VocabularyWordFamilyItem,
} from "@/types";

const CEFR_LEVELS = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);
const MAX_TEXT_ITEMS = 8;

function trimText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCefrLevel(value: unknown): VocabularyCefrLevel {
  const level = trimText(value).toUpperCase();
  return CEFR_LEVELS.has(level) ? (level as VocabularyCefrLevel) : "";
}

function normalizeTextArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const text = trimText(item);
    const key = text.toLowerCase();

    if (!text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(text);

    if (result.length >= MAX_TEXT_ITEMS) {
      break;
    }
  }

  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeWordFamily(value: unknown): VocabularyWordFamilyItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => ({
      word: trimText(item.word),
      part_of_speech: trimText(item.part_of_speech),
      thai_meaning: trimText(item.thai_meaning),
    }))
    .filter((item) => item.word)
    .slice(0, MAX_TEXT_ITEMS);
}

function normalizeCollocations(value: unknown): VocabularyCollocationItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => ({
      phrase: trimText(item.phrase),
      thai_meaning: trimText(item.thai_meaning),
      example: trimText(item.example),
    }))
    .filter((item) => item.phrase)
    .slice(0, MAX_TEXT_ITEMS);
}

export function normalizeVocabularyEnrichment(
  input: Partial<VocabularyLookupResult> | Record<string, unknown> | null | undefined
): VocabularyEnrichment {
  const source = input ?? {};

  return {
    lemma: trimText(source.lemma),
    cefr_level: normalizeCefrLevel(source.cefr_level),
    synonyms: normalizeTextArray(source.synonyms),
    antonyms: normalizeTextArray(source.antonyms),
    word_family: normalizeWordFamily(source.word_family),
    collocations: normalizeCollocations(source.collocations),
  };
}
