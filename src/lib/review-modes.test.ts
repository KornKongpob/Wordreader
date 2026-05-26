import assert from "node:assert/strict";
import test from "node:test";
import {
  createClozePrompt,
  getReviewAnswerFeedback,
  isReviewAnswerMatch,
} from "./review-modes";

test("isReviewAnswerMatch accepts case, punctuation, and spacing differences", () => {
  assert.equal(isReviewAnswerMatch("Interest rate", " interest-rate! "), true);
  assert.equal(isReviewAnswerMatch("market", "marketing"), false);
});

test("getReviewAnswerFeedback returns score and missing or extra words", () => {
  assert.deepEqual(getReviewAnswerFeedback("market volatility", "market activity"), {
    score: 50,
    missing: ["volatility"],
    extra: ["activity"],
    isCorrect: false,
  });
});

test("createClozePrompt blanks full words or phrases without matching substrings", () => {
  assert.deepEqual(
    createClozePrompt("The market volatility rose sharply.", "market volatility"),
    {
      prompt: "The _____ rose sharply.",
      answer: "market volatility",
      found: true,
    }
  );

  assert.deepEqual(createClozePrompt("The article was long.", "art"), {
    prompt: "The article was long.",
    answer: "art",
    found: false,
  });
});
