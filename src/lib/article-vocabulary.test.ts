import assert from "node:assert/strict";
import test from "node:test";
import {
  createArticleVocabularySavePayload,
  getArticleVocabularyKey,
  normalizeArticleVocabularySuggestions,
} from "./article-vocabulary";

test("normalizeArticleVocabularySuggestions trims, normalizes, and dedupes words", () => {
  const suggestions = normalizeArticleVocabularySuggestions([
    {
      word: " market volatility ",
      lemma: " volatility ",
      thai_meaning: " ความผันผวนของตลาด ",
      english_meaning: "changes in market prices",
      part_of_speech: " noun phrase ",
      cefr_level: "b2",
      difficulty: "hard",
      original_sentence: "Market volatility rose after the report.",
      why_useful_th: "ใช้บ่อยในข่าวเศรษฐกิจ",
    },
    {
      word: "Market volatility",
      lemma: "volatility",
      thai_meaning: "duplicate",
      english_meaning: "duplicate",
      part_of_speech: "noun phrase",
      cefr_level: "B2",
      difficulty: "medium",
      original_sentence: "Market volatility rose after the report.",
      why_useful_th: "duplicate",
    },
    {
      word: "policy makers",
      lemma: "",
      thai_meaning: "ผู้กำหนดนโยบาย",
      english_meaning: "people who decide policies",
      part_of_speech: "noun phrase",
      cefr_level: "native",
      difficulty: "tricky",
      original_sentence: "Policy makers met on Monday.",
      why_useful_th: "เจอบ่อยในข่าวการเมืองและเศรษฐกิจ",
    },
    {
      word: "",
      thai_meaning: "missing word",
    },
  ]);

  assert.deepEqual(suggestions, [
    {
      word: "market volatility",
      lemma: "volatility",
      thai_meaning: "ความผันผวนของตลาด",
      english_meaning: "changes in market prices",
      part_of_speech: "noun phrase",
      cefr_level: "B2",
      difficulty: "hard",
      original_sentence: "Market volatility rose after the report.",
      why_useful_th: "ใช้บ่อยในข่าวเศรษฐกิจ",
    },
    {
      word: "policy makers",
      lemma: "",
      thai_meaning: "ผู้กำหนดนโยบาย",
      english_meaning: "people who decide policies",
      part_of_speech: "noun phrase",
      cefr_level: "",
      difficulty: "medium",
      original_sentence: "Policy makers met on Monday.",
      why_useful_th: "เจอบ่อยในข่าวการเมืองและเศรษฐกิจ",
    },
  ]);
});

test("createArticleVocabularySavePayload maps a suggestion to the existing save API shape", () => {
  const payload = createArticleVocabularySavePayload({
    articleId: "11111111-1111-4111-8111-111111111111",
    articleTitle: "Markets move after report",
    articleSourceName: "Example News",
    suggestion: {
      word: "market volatility",
      lemma: "volatility",
      thai_meaning: "ความผันผวนของตลาด",
      english_meaning: "changes in market prices",
      part_of_speech: "noun phrase",
      cefr_level: "B2",
      difficulty: "hard",
      original_sentence: "Market volatility rose after the report.",
      why_useful_th: "ใช้บ่อยในข่าวเศรษฐกิจ",
    },
  });

  assert.equal(payload.text, "market volatility");
  assert.equal(payload.sentence, "Market volatility rose after the report.");
  assert.equal(payload.paragraph, "Market volatility rose after the report.");
  assert.equal(payload.translation.contextual_meaning, "ความผันผวนของตลาด");
  assert.equal(payload.translation.context_explanation, "ใช้บ่อยในข่าวเศรษฐกิจ");
  assert.equal(payload.translation.lemma, "volatility");
  assert.equal(payload.translation.cefr_level, "B2");
});

test("getArticleVocabularyKey normalizes duplicate checks consistently", () => {
  assert.equal(getArticleVocabularyKey("  Market   Volatility "), "market volatility");
});
