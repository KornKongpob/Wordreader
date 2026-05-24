import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { normalizeArticleVocabularySuggestions } from "@/lib/article-vocabulary";
import { normalizeVocabularyEnrichment } from "@/lib/vocabulary-enrichment";
import type {
  ArticleGuide,
  ArticleVocabularySuggestion,
  ChunkedArticleResult,
  DetectedIdiom,
  EnglishLevel,
  LearningGoal,
  LookupIntent,
  LookupMode,
  LookupResult,
  SentenceAnalysisResult,
  TranslationDensity,
} from "@/types";

export const OPENAI_MODEL = "gpt-4o-mini";

const openAIClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function getOpenAIClient() {
  if (!openAIClient) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  return openAIClient;
}

interface LookupInput {
  text: string;
  sentence: string;
  paragraph: string;
  articleTitle: string;
  mode: LookupMode;
  intent: LookupIntent;
}

interface SentenceAnalysisInput {
  sentence: string;
  paragraph?: string;
  articleTitle?: string;
}

interface ChunkTextInput {
  content: string;
  articleTitle?: string;
}

interface DetectIdiomsInput {
  content: string;
  articleTitle?: string;
}

interface QuizInput {
  articleTitle: string;
  content: string;
}

interface ArticleGuideInput {
  articleTitle: string;
  content: string;
  englishLevel: EnglishLevel;
  learningGoal: LearningGoal;
  translationDensity: TranslationDensity;
}

interface ArticleVocabularyInput {
  articleTitle: string;
  content: string;
  englishLevel: EnglishLevel;
}

const sentenceKeyPhraseSchema = z
  .object({
    phrase: z.string().min(1),
    thai_meaning: z.string().min(1),
    explanation: z.string().min(1),
  })
  .strict();

const vocabularyWordFamilySchema = z
  .object({
    word: z.string().min(1),
    part_of_speech: z.string().min(1),
    thai_meaning: z.string().min(1),
  })
  .strict();

const vocabularyCollocationSchema = z
  .object({
    phrase: z.string().min(1),
    thai_meaning: z.string().min(1),
    example: z.string().min(1),
  })
  .strict();

const vocabularyLookupSchema = z
  .object({
    thai_meaning: z.string().min(1),
    english_meaning: z.string().min(1),
    part_of_speech: z.string().min(1),
    contextual_meaning: z.string().min(1),
    context_explanation: z.string().min(1),
    difficulty: z.enum(["easy", "medium", "hard"]),
    lemma: z.string(),
    cefr_level: z.enum(["", "A1", "A2", "B1", "B2", "C1", "C2"]),
    synonyms: z.array(z.string().min(1)).max(6),
    antonyms: z.array(z.string().min(1)).max(6),
    word_family: z.array(vocabularyWordFamilySchema).max(8),
    collocations: z.array(vocabularyCollocationSchema).max(8),
  })
  .strict();

const sentenceTranslateSchema = z
  .object({
    thai_translation: z.string().min(1),
    gist: z.string().min(1),
  })
  .strict();

const sentenceExplainSchema = z
  .object({
    thai_translation: z.string().min(1),
    gist: z.string().min(1),
    structure_note: z.string().min(1),
    key_phrases: z.array(sentenceKeyPhraseSchema).max(3),
  })
  .strict();

const paragraphTranslateSchema = z
  .object({
    thai_translation: z.string().min(1),
    gist: z.string().min(1),
  })
  .strict();

const paragraphExplainSchema = z
  .object({
    thai_translation: z.string().min(1),
    gist: z.string().min(1),
    key_points: z.array(z.string().min(1)).min(2).max(3),
    key_phrases: z.array(sentenceKeyPhraseSchema).max(3),
  })
  .strict();

const sentenceAnalysisSchema = z
  .object({
    translation: z.string().min(1),
    tense: z.string().min(1),
    structure: z
      .array(
        z
          .object({
            part: z.string().min(1),
            text: z.string().min(1),
          })
          .strict()
      )
      .min(1)
      .max(8),
    explanation: z.string().min(1),
  })
  .strict();

const chunkedArticleSchema = z
  .object({
    html: z.string().min(1),
  })
  .strict();

const detectedIdiomsSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            phrase: z.string().min(1),
            meaning: z.string().min(1),
            type: z.enum(["idiom", "phrasal_verb"]),
          })
          .strict()
      )
      .max(16),
  })
  .strict();

const quizQuestionSchema = z
  .object({
    question: z.string().min(1),
    options: z.array(z.string().min(1)).length(4),
    answer_index: z.number().int().min(0).max(3),
    explanation: z.string().min(1),
  })
  .strict();

const quizSchema = z
  .object({
    questions: z.array(quizQuestionSchema).length(4),
  })
  .strict();

const articleGuideVocabularySchema = z
  .object({
    word: z.string().min(1),
    thai_meaning: z.string().min(1),
    simple_english_meaning: z.string().min(1),
  })
  .strict();

const articleGuideSchema = z
  .object({
    short_summary_th: z.string().min(1),
    why_it_matters_th: z.string().min(1),
    key_vocabulary: z.array(articleGuideVocabularySchema).min(5).max(8),
    background_context_th: z.string().min(1),
    reading_goals: z.array(z.string().min(1)).length(3),
  })
  .strict();

const articleVocabularySuggestionSchema = z
  .object({
    word: z.string().min(1),
    lemma: z.string(),
    thai_meaning: z.string().min(1),
    english_meaning: z.string().min(1),
    part_of_speech: z.string().min(1),
    cefr_level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
    difficulty: z.enum(["easy", "medium", "hard"]),
    original_sentence: z.string().min(1),
    why_useful_th: z.string().min(1),
  })
  .strict();

const articleVocabularySchema = z
  .object({
    items: z.array(articleVocabularySuggestionSchema).min(8).max(12),
  })
  .strict();

async function parseStructuredCompletion<T>({
  schema,
  schemaName,
  messages,
  temperature,
  maxTokens,
}: {
  schema: z.ZodType<T>;
  schemaName: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  temperature: number;
  maxTokens: number;
}) {
  const completion = await getOpenAIClient().chat.completions.parse({
    model: OPENAI_MODEL,
    temperature,
    max_tokens: maxTokens,
    messages,
    response_format: zodResponseFormat(schema, schemaName),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error(`No structured response returned for ${schemaName}.`);
  }

  return parsed;
}

export async function translateSelection(input: LookupInput): Promise<LookupResult> {
  const { text, sentence, paragraph, articleTitle, mode, intent } = input;

  if (mode === "vocab") {
    const parsed = await parseStructuredCompletion({
      schema: vocabularyLookupSchema,
      schemaName: "vocabulary_lookup",
      temperature: 0.25,
      maxTokens: 900,
      messages: [
        {
          role: "system",
          content:
            "You are an English-Thai vocabulary coach for Thai learners reading current English news. Use concise, natural Thai that a Thai reader would actually say. Do not sound literal or textbook-heavy.",
        },
        {
          role: "user",
          content: `Word or phrase: "${text}"
Sentence context: "${sentence}"
Article: "${articleTitle}"

Return:
- thai_meaning: concise natural Thai meaning in 1-4 words
- english_meaning: one plain-English definition
- part_of_speech: noun, verb, adjective, adverb, phrase, idiom, phrasal verb, etc.
- contextual_meaning: what it means in this sentence
- context_explanation: a short Thai-friendly explanation of why it means that here
- difficulty: easy, medium, or hard
- lemma: dictionary/base form, or the original phrase for idioms and fixed phrases
- cefr_level: best CEFR estimate from A1, A2, B1, B2, C1, C2; use "" if unknown
- synonyms: 0-6 useful English alternatives at a similar register
- antonyms: 0-6 useful English opposites if natural; otherwise []
- word_family: 0-8 related forms with word, part_of_speech, and concise Thai meaning
- collocations: 0-8 natural collocations or phrases learners should notice, each with phrase, thai_meaning, and a short English example`,
        },
      ],
    });
    const enrichment = normalizeVocabularyEnrichment(parsed);

    return {
      type: "vocab",
      intent: "translate",
      text,
      thai_meaning: parsed.thai_meaning.trim(),
      english_meaning: parsed.english_meaning.trim(),
      part_of_speech: parsed.part_of_speech.trim(),
      contextual_meaning: parsed.contextual_meaning.trim(),
      context_explanation: parsed.context_explanation.trim(),
      difficulty: parsed.difficulty,
      ...enrichment,
    };
  }

  if (mode === "sentence" && intent === "translate") {
    const parsed = await parseStructuredCompletion({
      schema: sentenceTranslateSchema,
      schemaName: "sentence_translate",
      temperature: 0.25,
      maxTokens: 520,
      messages: [
        {
          role: "system",
          content:
            "You are a Thai reading assistant for English news learners. Translate into smooth, natural Thai that sounds like a clear Thai news explanation, not a literal word-by-word conversion.",
        },
        {
          role: "user",
          content: `Selected sentence: "${text}"
Sentence context: "${sentence}"
Paragraph context: "${paragraph}"
Article: "${articleTitle}"

Return:
- thai_translation: a natural Thai translation
- gist: one short Thai sentence with the main point`,
        },
      ],
    });

    return {
      type: "sentence",
      intent: "translate",
      text,
      thai_translation: parsed.thai_translation.trim(),
      gist: parsed.gist.trim(),
    };
  }

  if (mode === "sentence" && intent === "explain") {
    const parsed = await parseStructuredCompletion({
      schema: sentenceExplainSchema,
      schemaName: "sentence_explain",
      temperature: 0.3,
      maxTokens: 720,
      messages: [
        {
          role: "system",
          content:
            "You are a Thai grammar and reading coach for English news learners. Explain sentence structure in learner-friendly Thai and keep the translation natural.",
        },
        {
          role: "user",
          content: `Selected sentence: "${text}"
Sentence context: "${sentence}"
Paragraph context: "${paragraph}"
Article: "${articleTitle}"

Return:
- thai_translation: a natural Thai translation
- gist: one short Thai sentence with the main idea
- structure_note: a short Thai explanation of the sentence structure
- key_phrases: 0 to 3 useful phrases from this sentence, each with phrase, thai_meaning, and explanation`,
        },
      ],
    });

    return {
      type: "sentence",
      intent: "explain",
      text,
      thai_translation: parsed.thai_translation.trim(),
      gist: parsed.gist.trim(),
      structure_note: parsed.structure_note.trim(),
      key_phrases: parsed.key_phrases.map((item) => ({
        phrase: item.phrase.trim(),
        thai_meaning: item.thai_meaning.trim(),
        explanation: item.explanation.trim(),
      })),
    };
  }

  if (mode === "paragraph" && intent === "translate") {
    const parsed = await parseStructuredCompletion({
      schema: paragraphTranslateSchema,
      schemaName: "paragraph_translate",
      temperature: 0.25,
      maxTokens: 820,
      messages: [
        {
          role: "system",
          content:
            "You are a Thai reading assistant for English news learners. Translate paragraphs into smooth, natural Thai and keep the summary easy to scan.",
        },
        {
          role: "user",
          content: `Selected paragraph: "${text}"
Sentence context: "${sentence}"
Paragraph context: "${paragraph}"
Article: "${articleTitle}"

Return:
- thai_translation: a natural Thai translation of the paragraph
- gist: one short Thai summary of the paragraph`,
        },
      ],
    });

    return {
      type: "paragraph",
      intent: "translate",
      text,
      thai_translation: parsed.thai_translation.trim(),
      gist: parsed.gist.trim(),
    };
  }

  const parsed = await parseStructuredCompletion({
    schema: paragraphExplainSchema,
    schemaName: "paragraph_explain",
    temperature: 0.3,
    maxTokens: 980,
    messages: [
      {
        role: "system",
        content:
          "You are a Thai reading coach for English news learners. Give a natural Thai translation plus short Thai reading support that helps the learner understand the paragraph faster.",
      },
      {
        role: "user",
        content: `Selected paragraph: "${text}"
Sentence context: "${sentence}"
Paragraph context: "${paragraph}"
Article: "${articleTitle}"

Return:
- thai_translation: a natural Thai translation
- gist: one short Thai summary
- key_points: 2 to 3 short Thai bullet-style takeaways
- key_phrases: 0 to 3 useful phrases, each with phrase, thai_meaning, and explanation`,
      },
    ],
  });

  return {
    type: "paragraph",
    intent: "explain",
    text,
    thai_translation: parsed.thai_translation.trim(),
    gist: parsed.gist.trim(),
    key_points: parsed.key_points.map((item) => item.trim()),
    key_phrases: parsed.key_phrases.map((item) => ({
      phrase: item.phrase.trim(),
      thai_meaning: item.thai_meaning.trim(),
      explanation: item.explanation.trim(),
    })),
  };
}

export async function analyzeSentence(
  input: SentenceAnalysisInput
): Promise<SentenceAnalysisResult> {
  const parsed = await parseStructuredCompletion({
    schema: sentenceAnalysisSchema,
    schemaName: "sentence_analysis",
    temperature: 0.25,
    maxTokens: 850,
    messages: [
      {
        role: "system",
        content:
          "You are a grammar coach for Thai learners reading English news. Give natural Thai explanations, identify the main tense, and break the sentence into readable grammar parts.",
      },
      {
        role: "user",
        content: `Sentence: "${input.sentence}"
Paragraph context: "${input.paragraph || ""}"
Article: "${input.articleTitle || "Unknown article"}"

Return:
- translation: a natural Thai translation
- tense: the main tense or grammar pattern in short form
- structure: an ordered array of parts like Subject, Verb, Object, Complement, Clause, Time phrase, etc., each with the exact text from the sentence
- explanation: a Thai explanation of how the sentence works grammatically and what makes it tricky for Thai learners`,
      },
    ],
  });

  return {
    translation: parsed.translation.trim(),
    tense: parsed.tense.trim(),
    structure: parsed.structure.map((item) => ({
      part: item.part.trim(),
      text: item.text.trim(),
    })),
    explanation: parsed.explanation.trim(),
  };
}

export async function chunkArticleText(input: ChunkTextInput): Promise<ChunkedArticleResult> {
  const parsed = await parseStructuredCompletion({
    schema: chunkedArticleSchema,
    schemaName: "chunked_article_html",
    temperature: 0.15,
    maxTokens: 4000,
    messages: [
      {
        role: "system",
        content:
          "You are an English reading helper for Thai learners. You receive article HTML and must preserve the original HTML structure exactly while adding only helpful span wrappers for chunking and collocations.",
      },
      {
        role: "user",
        content: `Article title: "${input.articleTitle || "Unknown article"}"

Rewrite the HTML with these rules:
1. Preserve the original text, tag order, nesting, and attributes exactly.
2. Do not remove tags, rename tags, reorder content, or add any tag other than span.
3. Insert <span class="text-muted/30 px-0.5" data-reader-separator="true">|</span> at natural reading pauses, especially before prepositions, conjunctions, time phrases, and clause boundaries.
4. Wrap natural collocations or grouped reading units with <span class="bg-primary/10 rounded px-1" data-reader-collocation="true">...</span>.
5. Do not split or wrap inside HTML tags, URLs, numbers, dates, abbreviations, or quoted punctuation.
6. Keep idioms, phrasal verbs, names, and fixed expressions together without separator bars inside them.
7. Return only the updated HTML string inside the JSON field.

Original HTML:
${input.content}`,
      },
    ],
  });

  return {
    html: parsed.html.trim(),
  };
}

export async function detectIdioms(input: DetectIdiomsInput): Promise<DetectedIdiom[]> {
  const parsed = await parseStructuredCompletion({
    schema: detectedIdiomsSchema,
    schemaName: "detected_idioms",
    temperature: 0.2,
    maxTokens: 900,
    messages: [
      {
        role: "system",
        content:
          "You detect idioms and phrasal verbs in English news articles for Thai learners. Only return phrases that appear verbatim in the visible article text.",
      },
      {
        role: "user",
        content: `Article title: "${input.articleTitle || "Unknown article"}"
Article HTML:
${input.content}

Find the trickiest idioms and phrasal verbs that appear exactly in this article.

Rules:
- Only include phrases that exist verbatim in the visible text.
- Prefer multi-word phrases that are easy for Thai learners to misread.
- Do not include duplicates.
- Keep the Thai meaning natural and concise.
- Return up to 12 items.`,
      },
    ],
  });

  const seen = new Set<string>();

  return parsed.items
    .map((item) => ({
      phrase: item.phrase.trim(),
      meaning: item.meaning.trim(),
      type: item.type,
    }))
    .filter((item) => {
      const key = item.phrase.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

export async function generateArticleGuide(input: ArticleGuideInput): Promise<ArticleGuide> {
  const trimmedContent = input.content.replace(/\s+/g, " ").slice(0, 10000);

  const parsed = await parseStructuredCompletion({
    schema: articleGuideSchema,
    schemaName: "article_learning_guide",
    temperature: 0.3,
    maxTokens: 1400,
    messages: [
      {
        role: "system",
        content:
          "You create concise pre-reading mini lessons for Thai learners reading current English news. Personalize the support to the learner profile without inventing facts beyond the article.",
      },
      {
        role: "user",
        content: `Article title: "${input.articleTitle}"
Learner English level: ${input.englishLevel}
Learning goal: ${input.learningGoal}
Translation density: ${input.translationDensity}

Create a pre-reading guide for this article.

Rules:
- short_summary_th: 2-3 natural Thai sentences.
- why_it_matters_th: 1-2 natural Thai sentences.
- key_vocabulary: 5-8 useful article words or phrases, each with a concise Thai meaning and a simple English meaning suitable for ${input.englishLevel}.
- background_context_th: short Thai context that helps a Thai learner understand the story.
- reading_goals: exactly 3 short bullet-style goals in English or Thai.
- If translation_density is minimal, keep Thai support brief. If full, give slightly more Thai context. If balanced, use concise Thai explanations.
- If learning_goal is business, exam, travel, or conversation, choose vocabulary and goals that support that goal.

Article content:
${trimmedContent}`,
      },
    ],
  });

  return {
    short_summary_th: parsed.short_summary_th.trim(),
    why_it_matters_th: parsed.why_it_matters_th.trim(),
    background_context_th: parsed.background_context_th.trim(),
    reading_goals: parsed.reading_goals.map((goal) => goal.trim()).slice(0, 3),
    key_vocabulary: parsed.key_vocabulary.slice(0, 8).map((item) => ({
      word: item.word.trim(),
      thai_meaning: item.thai_meaning.trim(),
      simple_english_meaning: item.simple_english_meaning.trim(),
    })),
  };
}

export async function suggestArticleVocabulary(
  input: ArticleVocabularyInput
): Promise<ArticleVocabularySuggestion[]> {
  const trimmedContent = input.content.replace(/\s+/g, " ").slice(0, 11000);

  const parsed = await parseStructuredCompletion({
    schema: articleVocabularySchema,
    schemaName: "article_vocabulary_suggestions",
    temperature: 0.25,
    maxTokens: 1800,
    messages: [
      {
        role: "system",
        content:
          "You are an English-Thai vocabulary coach for Thai learners reading current English news. Select vocabulary that is genuinely useful for understanding and discussing the article.",
      },
      {
        role: "user",
        content: `Article title: "${input.articleTitle}"
Learner English level: ${input.englishLevel}

Find 8-12 useful words or phrases from this article for a learner at ${input.englishLevel}.

Rules:
- Choose words or short phrases that appear in the article text.
- Avoid vocabulary that is far too easy or far too hard for ${input.englishLevel}; include a few stretch words when they are central to the article.
- Prefer news vocabulary, collocations, phrasal verbs, and terms that help understand the main story.
- Do not include proper names unless the phrase is a reusable term.
- original_sentence must be one sentence from the article that contains the word or phrase.
- why_useful_th should explain in natural Thai why this item is worth learning from this article.

Return each item with:
- word
- lemma
- thai_meaning
- english_meaning
- part_of_speech
- cefr_level
- difficulty
- original_sentence
- why_useful_th

Article content:
${trimmedContent}`,
      },
    ],
  });

  return normalizeArticleVocabularySuggestions(parsed.items);
}

export async function generateArticleQuiz(input: QuizInput) {
  const trimmedContent = input.content.replace(/\s+/g, " ").slice(0, 9000);

  const parsed = await parseStructuredCompletion({
    schema: quizSchema,
    schemaName: "article_quiz",
    temperature: 0.35,
    maxTokens: 900,
    messages: [
      {
        role: "system",
        content:
          "You create short reading-comprehension quizzes for English learners. Keep the questions clear and the distractors plausible.",
      },
      {
        role: "user",
        content: `Create exactly 4 multiple-choice questions for this article.

Article title: "${input.articleTitle}"
Article content: "${trimmedContent}"

Return:
- questions: array of 4 items

Each item must have:
- question: concise question in English
- options: exactly 4 short options
- answer_index: the 0-based index of the correct option
- explanation: one short sentence explaining the answer`,
      },
    ],
  });

  return parsed.questions.map((item) => ({
    question: item.question.trim(),
    options: item.options.map((option) => option.trim()),
    answer_index: item.answer_index,
    explanation: item.explanation.trim(),
  }));
}
