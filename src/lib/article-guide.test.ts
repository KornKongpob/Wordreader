import assert from "node:assert/strict";
import test from "node:test";
import {
  createArticleGuideInputHash,
  isArticleGuidePayload,
} from "./article-guide";

const validGuide = {
  short_summary_th: "บทความนี้อธิบายประเด็นสำคัญก่อนอ่าน",
  why_it_matters_th: "เรื่องนี้สำคัญเพราะเกี่ยวกับชีวิตประจำวัน",
  background_context_th: "ผู้เรียนไทยควรรู้บริบทพื้นฐานก่อนอ่านข่าวนี้",
  reading_goals: ["Find the main idea", "Notice cause and effect", "Review key words"],
  key_vocabulary: [
    { word: "policy", thai_meaning: "นโยบาย", simple_english_meaning: "a plan or rule" },
    { word: "market", thai_meaning: "ตลาด", simple_english_meaning: "where things are sold" },
    { word: "impact", thai_meaning: "ผลกระทบ", simple_english_meaning: "an effect" },
    { word: "official", thai_meaning: "เจ้าหน้าที่", simple_english_meaning: "a person in authority" },
    { word: "growth", thai_meaning: "การเติบโต", simple_english_meaning: "getting bigger" },
  ],
};

test("isArticleGuidePayload accepts a complete article guide", () => {
  assert.equal(isArticleGuidePayload(validGuide), true);
});

test("isArticleGuidePayload rejects incomplete cached guide payloads", () => {
  assert.equal(
    isArticleGuidePayload({
      ...validGuide,
      reading_goals: ["Only one goal"],
    }),
    false
  );
  assert.equal(
    isArticleGuidePayload({
      ...validGuide,
      key_vocabulary: validGuide.key_vocabulary.slice(0, 4),
    }),
    false
  );
});

test("createArticleGuideInputHash changes when learner profile inputs change", () => {
  const base = createArticleGuideInputHash({
    content: "<p>Article body</p>",
    englishLevel: "B1",
    learningGoal: "general",
    translationDensity: "balanced",
  });
  const changedLevel = createArticleGuideInputHash({
    content: "<p>Article body</p>",
    englishLevel: "C1",
    learningGoal: "general",
    translationDensity: "balanced",
  });

  assert.equal(base, createArticleGuideInputHash({
    content: "<p>Article body</p>",
    englishLevel: "B1",
    learningGoal: "general",
    translationDensity: "balanced",
  }));
  assert.notEqual(base, changedLevel);
});
