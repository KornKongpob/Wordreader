import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVocabularyEnrichment } from "./vocabulary-enrichment";

test("normalizeVocabularyEnrichment trims, dedupes, and keeps valid enrichment", () => {
  const result = normalizeVocabularyEnrichment({
    lemma: "  invest  ",
    cefr_level: "B2",
    synonyms: [" fund ", "finance", "fund", ""],
    antonyms: [" divest ", " "],
    word_family: [
      { word: "investment", part_of_speech: " noun ", thai_meaning: " การลงทุน " },
      { word: "" },
    ],
    collocations: [
      {
        phrase: "make an investment",
        thai_meaning: "ลงทุน",
        example: "The company made an investment.",
      },
      { phrase: " " },
    ],
  });

  assert.deepEqual(result, {
    lemma: "invest",
    cefr_level: "B2",
    synonyms: ["fund", "finance"],
    antonyms: ["divest"],
    word_family: [
      {
        word: "investment",
        part_of_speech: "noun",
        thai_meaning: "การลงทุน",
      },
    ],
    collocations: [
      {
        phrase: "make an investment",
        thai_meaning: "ลงทุน",
        example: "The company made an investment.",
      },
    ],
  });
});

test("normalizeVocabularyEnrichment falls back safely for old or invalid rows", () => {
  const result = normalizeVocabularyEnrichment({
    cefr_level: "native",
    synonyms: null,
    antonyms: undefined,
    word_family: "not json",
    collocations: [{ thai_meaning: "ไม่มี phrase" }],
  });

  assert.deepEqual(result, {
    lemma: "",
    cefr_level: "",
    synonyms: [],
    antonyms: [],
    word_family: [],
    collocations: [],
  });
});
