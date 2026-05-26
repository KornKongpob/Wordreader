import type {
  ArticleQuizAttemptAnswer,
  ArticleQuizAttemptInsert,
  QuizQuestion,
} from "@/types";

interface BuildArticleQuizAttemptPayloadInput {
  userId: string;
  articleId: string;
  articleQuizId?: string | null;
  questions: QuizQuestion[];
  selectedAnswers: Record<number, number>;
  completedAt?: string;
}

interface QuizAttemptSummaryInput {
  score: number;
  total: number;
}

export interface QuizAttemptSummary {
  completed: number;
  averagePercent: number;
}

export function getQuizScore(
  questions: QuizQuestion[],
  selectedAnswers: Record<number, number>
) {
  return questions.reduce((total, question, index) => {
    return total + (selectedAnswers[index] === question.answer_index ? 1 : 0);
  }, 0);
}

export function buildQuizAttemptAnswers(
  questions: QuizQuestion[],
  selectedAnswers: Record<number, number>
): ArticleQuizAttemptAnswer[] {
  return questions.map((question, index) => {
    const selectedOption = selectedAnswers[index];

    if (selectedOption === undefined) {
      throw new Error("Answer all questions before saving this attempt.");
    }

    return {
      question_index: index,
      selected_option_index: selectedOption,
      correct_option_index: question.answer_index,
      is_correct: selectedOption === question.answer_index,
    };
  });
}

export function buildArticleQuizAttemptPayload({
  userId,
  articleId,
  articleQuizId = null,
  questions,
  selectedAnswers,
  completedAt = new Date().toISOString(),
}: BuildArticleQuizAttemptPayloadInput): ArticleQuizAttemptInsert {
  const answers = buildQuizAttemptAnswers(questions, selectedAnswers);

  return {
    user_id: userId,
    article_id: articleId,
    article_quiz_id: articleQuizId,
    score: getQuizScore(questions, selectedAnswers),
    total: questions.length,
    answers,
    completed_at: completedAt,
  };
}

export function summarizeQuizAttempts(
  attempts: QuizAttemptSummaryInput[]
): QuizAttemptSummary {
  const completedAttempts = attempts.filter((attempt) => attempt.total > 0);

  if (completedAttempts.length === 0) {
    return {
      completed: 0,
      averagePercent: 0,
    };
  }

  const percentTotal = completedAttempts.reduce((total, attempt) => {
    return total + (attempt.score / attempt.total) * 100;
  }, 0);

  return {
    completed: completedAttempts.length,
    averagePercent: Math.round(percentTotal / completedAttempts.length),
  };
}
