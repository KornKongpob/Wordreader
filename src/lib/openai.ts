import OpenAI from "openai";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return new OpenAI({ apiKey });
}

interface TranslationInput {
  word: string;
  sentence: string;
  articleTitle: string;
}

interface TranslationOutput {
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  contextual_meaning: string;
  context_explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

export async function translateWord(
  input: TranslationInput
): Promise<TranslationOutput> {
  const { word, sentence, articleTitle } = input;

  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: 500,
    messages: [
      {
        role: "system",
        content: `You are an English-Thai vocabulary assistant for a Thai learner reading English news articles. Given a word/phrase, its sentence context, and the article title, provide a concise vocabulary entry. Respond in JSON only, no markdown.`,
      },
      {
        role: "user",
        content: `Word or phrase: "${word}"
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

  return {
    thai_meaning: parsed.thai_meaning || "",
    english_meaning: parsed.english_meaning || "",
    part_of_speech: parsed.part_of_speech || "",
    contextual_meaning: parsed.contextual_meaning || "",
    context_explanation: parsed.context_explanation || "",
    difficulty: ["easy", "medium", "hard"].includes(parsed.difficulty)
      ? parsed.difficulty
      : "medium",
  };
}
