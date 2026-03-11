import OpenAI from "openai";
import type { LookupMode, LookupResult, SentenceKeyPhrase } from "@/types";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return new OpenAI({ apiKey });
}

interface LookupInput {
  text: string;
  sentence: string;
  articleTitle: string;
  mode: LookupMode;
}

interface RawSentenceKeyPhrase {
  phrase?: unknown;
  thai_meaning?: unknown;
  explanation?: unknown;
}

interface QuizInput {
  articleTitle: string;
  content: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
}

interface RawQuizQuestion {
  question?: unknown;
  options?: unknown;
  answer_index?: unknown;
  explanation?: unknown;
}

export async function translateSelection(
  input: LookupInput
): Promise<LookupResult> {
  const { text, sentence, articleTitle, mode } = input;

  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: mode === "sentence" ? 800 : 500,
    messages: [
      {
        role: "system",
        content:
          mode === "sentence"
            ? `You are an English-Thai reading coach for a Thai learner reading English news articles. Given a selected sentence, its surrounding sentence context, and the article title, explain the sentence in a concise, learner-friendly way. Respond in JSON only, no markdown.`
            : `You are an English-Thai vocabulary assistant for a Thai learner reading English news articles. Given a word/phrase, its sentence context, and the article title, provide a concise vocabulary entry. Respond in JSON only, no markdown.`,
      },
      {
        role: "user",
        content:
          mode === "sentence"
            ? `Selected sentence: "${text}"
Sentence: "${sentence}"
Article: "${articleTitle}"

Return JSON with these exact keys:
- thai_translation: Natural Thai translation of the full sentence (1-2 sentences max)
- simple_english: Simpler English paraphrase of the sentence (1 short sentence)
- grammar_note: Brief grammar or structure note that helps the learner decode the sentence (1 short sentence)
- usage_note: Brief note about tone, implication, or why the sentence is phrased this way (1 short sentence)
- key_phrases: array with 0 to 3 items, each item has phrase, thai_meaning, explanation`
            : `Word or phrase: "${text}"
Sentence: "${sentence}"
Article: "${articleTitle}"

Return JSON with these exact keys:
- thai_meaning: Thai translation (concise, 1-3 words)
- english_meaning: Simple English definition (1 short sentence)
- part_of_speech: e.g. noun, verb, adjective, adverb, phrase, idiom
- contextual_meaning: What this word/phrase means specifically in this sentence (1 sentence, in English)
- context_explanation: Brief explanation of why it has this meaning here (1 sentence, in English, learner-friendly)
- difficulty: "easy", "medium", or "hard" based on CEFR level (A1-A2=easy, B1-B2=medium, C1-C2=hard)`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const parsed = JSON.parse(content);

  if (mode === "sentence") {
    const keyPhrases = Array.isArray(parsed.key_phrases)
      ? (parsed.key_phrases as RawSentenceKeyPhrase[])
          .map((item): SentenceKeyPhrase => ({
            phrase: String(item.phrase || "").trim(),
            thai_meaning: String(item.thai_meaning || "").trim(),
            explanation: String(item.explanation || "").trim(),
          }))
          .filter((item) => item.phrase.length > 0)
          .slice(0, 3)
      : [];

    return {
      type: "sentence",
      text,
      thai_translation: String(parsed.thai_translation || "").trim(),
      simple_english: String(parsed.simple_english || "").trim(),
      grammar_note: String(parsed.grammar_note || "").trim(),
      usage_note: String(parsed.usage_note || "").trim(),
      key_phrases: keyPhrases,
    };
  }

  return {
    type: "vocab",
    text,
    thai_meaning: String(parsed.thai_meaning || "").trim(),
    english_meaning: String(parsed.english_meaning || "").trim(),
    part_of_speech: String(parsed.part_of_speech || "").trim(),
    contextual_meaning: String(parsed.contextual_meaning || "").trim(),
    context_explanation: String(parsed.context_explanation || "").trim(),
    difficulty: ["easy", "medium", "hard"].includes(parsed.difficulty)
      ? parsed.difficulty
      : "medium",
  };
}

export async function generateArticleQuiz(
  input: QuizInput
): Promise<QuizQuestion[]> {
  const openai = getOpenAIClient();
  const trimmedContent = input.content.replace(/\s+/g, " ").slice(0, 9000);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 900,
    messages: [
      {
        role: "system",
        content:
          "You create short reading-comprehension quizzes for English learners. Respond in JSON only.",
      },
      {
        role: "user",
        content: `Create exactly 4 multiple-choice questions for this article.

Article title: "${input.articleTitle}"
Article content: "${trimmedContent}"

Return JSON with a single key:
- questions: array of 4 items

Each question item must have:
- question: concise question in English
- options: array of exactly 4 short options
- answer_index: 0-based index of the correct option
- explanation: one short sentence explaining the answer`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No quiz response from OpenAI");
  }

  const parsed = JSON.parse(content);
  const questions = Array.isArray(parsed.questions)
    ? (parsed.questions as RawQuizQuestion[])
    : [];

  return questions
    .filter((item) => Array.isArray(item.options) && item.options.length === 4)
    .slice(0, 4)
    .map((item): QuizQuestion => {
      const answerIndex =
        typeof item.answer_index === "number" &&
        Number.isInteger(item.answer_index) &&
        item.answer_index >= 0 &&
        item.answer_index < 4
          ? item.answer_index
          : 0;

      return {
        question: String(item.question || ""),
        options: (item.options as unknown[]).map((option) => String(option)),
        answer_index: answerIndex,
        explanation: String(item.explanation || ""),
      };
    });
}
