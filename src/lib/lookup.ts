import type { LookupIntent, LookupMode, ReaderLookupStyle } from "@/types";

export const WORD_SELECTION_MAX_LENGTH = 48;
export const SMART_SELECTION_MAX_LENGTH = 900;

export interface LookupSelectionInput {
  text: string;
  sentence: string;
  paragraph: string;
}

export interface LookupRequest extends LookupSelectionInput {
  mode: LookupMode;
  intent: LookupIntent;
}

export function normalizeLookupStyle(value?: string | null): ReaderLookupStyle {
  return value === "word" ? "word" : "phrase";
}

export function getStoredLookupStyle(): ReaderLookupStyle {
  if (typeof window === "undefined") return "phrase";
  return normalizeLookupStyle(localStorage.getItem("readerLookupMode"));
}

export function persistLookupStyle(style: ReaderLookupStyle) {
  if (typeof window === "undefined") return;
  localStorage.setItem("readerLookupMode", style);
}

export function getSelectionMaxLength(style: ReaderLookupStyle) {
  return style === "word" ? WORD_SELECTION_MAX_LENGTH : SMART_SELECTION_MAX_LENGTH;
}

export function normalizeLookupText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function countWords(value: string) {
  return normalizeLookupText(value)
    .split(" ")
    .filter(Boolean).length;
}

function countSentences(value: string) {
  return normalizeLookupText(value)
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

export function isSelectionTooLong(text: string, style: ReaderLookupStyle) {
  const maxLength = getSelectionMaxLength(style);
  return normalizeLookupText(text).length > maxLength;
}

export function inferLookupMode(
  selection: LookupSelectionInput,
  style: ReaderLookupStyle
): LookupMode {
  if (style === "word") {
    return "vocab";
  }

  const normalizedText = normalizeLookupText(selection.text);
  const normalizedSentence = normalizeLookupText(selection.sentence);
  const normalizedParagraph = normalizeLookupText(selection.paragraph);

  if (!normalizedText) {
    return "vocab";
  }

  const selectedWordCount = countWords(normalizedText);
  const selectedSentenceCount = countSentences(normalizedText);
  const paragraphSentenceCount = countSentences(normalizedParagraph);

  if (
    selectedSentenceCount > 1 ||
    normalizedText.length >= 220 ||
    (normalizedParagraph.length > 0 &&
      normalizedText === normalizedParagraph &&
      paragraphSentenceCount > 1)
  ) {
    return "paragraph";
  }

  if (
    normalizedText === normalizedSentence ||
    /[.!?]/.test(normalizedText) ||
    normalizedText.length >= 60 ||
    selectedWordCount >= 8
  ) {
    return "sentence";
  }

  return "vocab";
}

export function createLookupCacheKey(articleId: string, request: LookupRequest) {
  return [
    articleId,
    request.mode,
    request.intent,
    normalizeLookupText(request.text).toLowerCase(),
    normalizeLookupText(request.sentence),
    normalizeLookupText(request.paragraph),
  ].join("::");
}
