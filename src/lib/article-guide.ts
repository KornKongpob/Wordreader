import { hashArticleInput } from "./ai-artifacts";
import type {
  ArticleGuide,
  ArticleGuideVocabularyItem,
  EnglishLevel,
  LearningGoal,
  TranslationDensity,
} from "../types";

export interface ArticleGuideInputProfile {
  content: string;
  englishLevel: EnglishLevel;
  learningGoal: LearningGoal;
  translationDensity: TranslationDensity;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isVocabularyItem(value: unknown): value is ArticleGuideVocabularyItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "word" in value &&
    "thai_meaning" in value &&
    "simple_english_meaning" in value &&
    isNonEmptyString(value.word) &&
    isNonEmptyString(value.thai_meaning) &&
    isNonEmptyString(value.simple_english_meaning)
  );
}

export function isArticleGuidePayload(value: unknown): value is ArticleGuide {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (
    !("short_summary_th" in value) ||
    !("why_it_matters_th" in value) ||
    !("background_context_th" in value) ||
    !("reading_goals" in value) ||
    !("key_vocabulary" in value)
  ) {
    return false;
  }

  return (
    isNonEmptyString(value.short_summary_th) &&
    isNonEmptyString(value.why_it_matters_th) &&
    isNonEmptyString(value.background_context_th) &&
    Array.isArray(value.reading_goals) &&
    value.reading_goals.length === 3 &&
    value.reading_goals.every(isNonEmptyString) &&
    Array.isArray(value.key_vocabulary) &&
    value.key_vocabulary.length >= 5 &&
    value.key_vocabulary.length <= 8 &&
    value.key_vocabulary.every(isVocabularyItem)
  );
}

export function createArticleGuideInputHash({
  content,
  englishLevel,
  learningGoal,
  translationDensity,
}: ArticleGuideInputProfile): string {
  return hashArticleInput(
    JSON.stringify({
      content,
      englishLevel,
      learningGoal,
      translationDensity,
    })
  );
}
