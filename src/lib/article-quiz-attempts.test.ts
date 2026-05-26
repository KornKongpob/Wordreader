import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArticleQuizAttemptPayload,
  summarizeQuizAttempts,
} from "./article-quiz-attempts";
import type { QuizQuestion } from "@/types";

const questions: QuizQuestion[] = [
  {
    question: "What happened?",
    options: ["A", "B", "C"],
    answer_index: 1,
    explanation: "B is correct.",
  },
  {
    question: "Why did it matter?",
    options: ["X", "Y", "Z"],
    answer_index: 2,
    explanation: "Z is correct.",
  },
];

test("buildArticleQuizAttemptPayload stores score, total, and selected answers", () => {
  const payload = buildArticleQuizAttemptPayload({
    userId: "user-1",
    articleId: "article-1",
    articleQuizId: "quiz-1",
    questions,
    selectedAnswers: { 0: 1, 1: 0 },
    completedAt: "2026-05-26T09:00:00.000Z",
  });

  assert.equal(payload.user_id, "user-1");
  assert.equal(payload.article_id, "article-1");
  assert.equal(payload.article_quiz_id, "quiz-1");
  assert.equal(payload.score, 1);
  assert.equal(payload.total, 2);
  assert.equal(payload.completed_at, "2026-05-26T09:00:00.000Z");
  assert.deepEqual(payload.answers, [
    {
      question_index: 0,
      selected_option_index: 1,
      correct_option_index: 1,
      is_correct: true,
    },
    {
      question_index: 1,
      selected_option_index: 0,
      correct_option_index: 2,
      is_correct: false,
    },
  ]);
});

test("buildArticleQuizAttemptPayload rejects incomplete attempts", () => {
  assert.throws(
    () =>
      buildArticleQuizAttemptPayload({
        userId: "user-1",
        articleId: "article-1",
        questions,
        selectedAnswers: { 0: 1 },
      }),
    /all questions/i
  );
});

test("summarizeQuizAttempts returns completed count and average percent", () => {
  assert.deepEqual(
    summarizeQuizAttempts([
      { score: 4, total: 5 },
      { score: 3, total: 5 },
      { score: 0, total: 0 },
    ]),
    {
      completed: 2,
      averagePercent: 70,
    }
  );
});
