import { compareDictation, normalizeForDictation } from "./text-compare";

export interface ReviewAnswerFeedback {
  score: number;
  missing: string[];
  extra: string[];
  isCorrect: boolean;
}

export interface ClozePrompt {
  prompt: string;
  answer: string;
  found: boolean;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTargetPattern(target: string) {
  const tokens = target.trim().split(/\s+/).map(escapeRegExp);
  if (tokens.length === 0) return null;

  return new RegExp(`(?<![A-Za-z0-9])${tokens.join("\\s+")}(?![A-Za-z0-9])`, "i");
}

export function normalizeReviewAnswer(value: string) {
  return normalizeForDictation(value);
}

export function isReviewAnswerMatch(expected: string, actual: string) {
  const normalizedExpected = normalizeReviewAnswer(expected);
  const normalizedActual = normalizeReviewAnswer(actual);

  return Boolean(normalizedExpected) && normalizedExpected === normalizedActual;
}

export function getReviewAnswerFeedback(
  expected: string,
  actual: string
): ReviewAnswerFeedback {
  const comparison = compareDictation(expected, actual);

  return {
    ...comparison,
    isCorrect: isReviewAnswerMatch(expected, actual),
  };
}

export function createClozePrompt(sentence: string, target: string): ClozePrompt {
  const prompt = sentence.trim();
  const answer = target.trim();
  const pattern = buildTargetPattern(answer);

  if (!prompt || !answer || !pattern) {
    return {
      prompt: prompt || "_____",
      answer,
      found: false,
    };
  }

  if (!pattern.test(prompt)) {
    return {
      prompt,
      answer,
      found: false,
    };
  }

  return {
    prompt: prompt.replace(pattern, "_____"),
    answer,
    found: true,
  };
}
