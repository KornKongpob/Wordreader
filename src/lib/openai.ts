import OpenAI from "openai";
import type { LookupIntent, LookupMode, LookupResult, SentenceKeyPhrase } from "@/types";

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
  paragraph: string;
  articleTitle: string;
  mode: LookupMode;
  intent: LookupIntent;
}

interface RawSentenceKeyPhrase {
  phrase?: unknown;
  thai_meaning?: unknown;
  explanation?: unknown;
}

interface RawParagraphPoint {
  point?: unknown;
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
  const { text, sentence, paragraph, articleTitle, mode, intent } = input;

  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: mode === "paragraph" ? 1000 : mode === "sentence" ? 800 : 500,
    messages: [
      {
        role: "system",
        content:
          mode === "vocab"
            ? `You are an English-Thai vocabulary assistant for a Thai learner reading English news articles. Give concise, natural Thai meanings. Respond in JSON only, no markdown.`
            : `You are an English-Thai news reading assistant for a Thai learner. Write natural Thai that sounds like a clear Thai news summary, not a literal translation. Avoid awkward learner-English phrasing. Keep translate mode concise and fast to read. Use explain mode only for extra reading help. Respond in JSON only, no markdown.`,
      },
      {
        role: "user",
        content:
          mode === "vocab"
            ? `Word or phrase: "${text}"
Sentence context: "${sentence}"
Article: "${articleTitle}"

Return JSON with these exact keys:
- thai_meaning: concise Thai meaning (1-4 words, natural Thai)
- english_meaning: simple English definition (1 short sentence)
- part_of_speech: e.g. noun, verb, adjective, adverb, phrase, idiom
- contextual_meaning: what this word/phrase means specifically in this sentence (1 short sentence)
- context_explanation: brief learner-friendly explanation for this context (1 short sentence)
- difficulty: "easy", "medium", or "hard"`
            : mode === "sentence" && intent === "translate"
              ? `Selected sentence: "${text}"
Sentence context: "${sentence}"
Paragraph context: "${paragraph}"
Article: "${articleTitle}"

Return JSON with these exact keys:
- thai_translation: natural Thai translation of the sentence
- gist: one short Thai sentence capturing the main point`
              : mode === "sentence" && intent === "explain"
                ? `Selected sentence: "${text}"
Sentence context: "${sentence}"
Paragraph context: "${paragraph}"
Article: "${articleTitle}"

Return JSON with these exact keys:
- thai_translation: natural Thai translation of the sentence
- gist: one short Thai sentence capturing the main point
- structure_note: one short Thai note explaining the structure or phrasing
- key_phrases: array with 0 to 3 items, each item has phrase, thai_meaning, explanation`
                : mode === "paragraph" && intent === "translate"
                  ? `Selected paragraph: "${text}"
Sentence context: "${sentence}"
Paragraph context: "${paragraph}"
Article: "${articleTitle}"

Return JSON with these exact keys:
- thai_translation: natural Thai translation of the paragraph
- gist: one short Thai summary of the paragraph`
                  : `Selected paragraph: "${text}"
Sentence context: "${sentence}"
Paragraph context: "${paragraph}"
Article: "${articleTitle}"

Return JSON with these exact keys:
- thai_translation: natural Thai translation of the paragraph
- gist: one short Thai summary of the paragraph
- key_points: array with 2 to 3 short Thai points
- key_phrases: array with 0 to 3 items, each item has phrase, thai_meaning, explanation`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const parsed = JSON.parse(content);
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

  if (mode === "sentence" && intent === "translate") {
    return {
      type: "sentence",
      intent: "translate",
      text,
      thai_translation: String(parsed.thai_translation || "").trim(),
      gist: String(parsed.gist || "").trim(),
    };
  }

  if (mode === "sentence" && intent === "explain") {
    return {
      type: "sentence",
      intent: "explain",
      text,
      thai_translation: String(parsed.thai_translation || "").trim(),
      gist: String(parsed.gist || "").trim(),
      structure_note: String(parsed.structure_note || "").trim(),
      key_phrases: keyPhrases,
    };
  }

  if (mode === "paragraph" && intent === "translate") {
    return {
      type: "paragraph",
      intent: "translate",
      text,
      thai_translation: String(parsed.thai_translation || "").trim(),
      gist: String(parsed.gist || "").trim(),
    };
  }

  if (mode === "paragraph" && intent === "explain") {
    const keyPoints = Array.isArray(parsed.key_points)
      ? (parsed.key_points as Array<string | RawParagraphPoint>)
          .map((item) =>
            typeof item === "string"
              ? item.trim()
              : String(item.point || "").trim()
          )
          .filter(Boolean)
          .slice(0, 3)
      : [];

    return {
      type: "paragraph",
      intent: "explain",
      text,
      thai_translation: String(parsed.thai_translation || "").trim(),
      gist: String(parsed.gist || "").trim(),
      key_points: keyPoints,
      key_phrases: keyPhrases,
    };
  }

  return {
    type: "vocab",
    intent: "translate",
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
