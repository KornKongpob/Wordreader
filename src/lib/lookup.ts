import type { LookupMode, ReaderLookupStyle } from "@/types";

export interface LookupSelectionInput {
  text: string;
  sentence: string;
}

export interface LookupRequest extends LookupSelectionInput {
  mode: LookupMode;
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
  return style === "word" ? 48 : 240;
}

export function normalizeLookupText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function countWords(value: string) {
  return normalizeLookupText(value)
    .split(" ")
    .filter(Boolean).length;
}

export function inferLookupMode(
  selectionText: string,
  sentence: string,
  style: ReaderLookupStyle
): LookupMode {
  if (style === "word") {
    return "vocab";
  }

  const normalizedSelection = normalizeLookupText(selectionText);
  const normalizedSentence = normalizeLookupText(sentence);

  if (!normalizedSelection) {
    return "vocab";
  }

  if (normalizedSelection === normalizedSentence) {
    return "sentence";
  }

  if (/[.!?]/.test(normalizedSelection)) {
    return "sentence";
  }

  if (normalizedSelection.length >= 60) {
    return "sentence";
  }

  if (countWords(normalizedSelection) >= 8) {
    return "sentence";
  }

  return "vocab";
}

export function createLookupCacheKey(articleId: string, request: LookupRequest) {
  return [
    articleId,
    request.mode,
    normalizeLookupText(request.text).toLowerCase(),
    normalizeLookupText(request.sentence),
  ].join("::");
}
