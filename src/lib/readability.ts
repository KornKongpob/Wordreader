export type DifficultyLevel = "Easy" | "Medium" | "Hard";

interface ReadabilityStats {
  wordCount: number;
  averageSentenceLength: number;
  averageWordLength: number;
  punctuationDensity: number;
}

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu;
const READING_WORDS_PER_MINUTE = 220;

function toPlainText(textOrHtml: string) {
  return textOrHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getWordsFromPlainText(plainText: string): string[] {
  const matches = plainText.match(WORD_PATTERN);
  return matches ? Array.from(matches) : [];
}

function getWords(textOrHtml: string) {
  return getWordsFromPlainText(toPlainText(textOrHtml));
}

function getStats(textOrHtml: string): ReadabilityStats {
  const plainText = toPlainText(textOrHtml);
  const words = getWordsFromPlainText(plainText);
  const sentences = plainText
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const wordCharacterCount = words.reduce(
    (total, word) => total + word.replace(/['\u2019-]/g, "").length,
    0
  );
  const punctuationCount = (plainText.match(/[,:;()[\]"]/g) ?? []).length;
  const sentenceCount = Math.max(1, sentences.length);

  return {
    wordCount: words.length,
    averageSentenceLength: words.length / sentenceCount,
    averageWordLength: words.length > 0 ? wordCharacterCount / words.length : 0,
    punctuationDensity: plainText.length > 0 ? punctuationCount / plainText.length : 0,
  };
}

function getDifficultyReason(stats: ReadabilityStats, score: number) {
  if (score <= 1) {
    return "Short sentences and familiar word length";
  }

  const reasons: string[] = [];

  if (stats.wordCount >= 900) reasons.push("long article");
  if (stats.averageSentenceLength >= 24) reasons.push("long sentences");
  if (stats.averageWordLength >= 6) reasons.push("advanced vocabulary");
  if (stats.punctuationDensity >= 0.045) reasons.push("dense punctuation");

  return reasons.length > 0
    ? reasons.join(", ")
    : "Moderate sentence length and vocabulary";
}

export function getPlainWordCount(textOrHtml: string): number {
  return getWords(textOrHtml).length;
}

export function estimateReadingMinutes(wordCount: number): number {
  return Math.max(1, Math.ceil(Math.max(0, wordCount) / READING_WORDS_PER_MINUTE));
}

export function estimateDifficultyFromText(
  textOrHtml: string
): { level: DifficultyLevel; reason: string } {
  const stats = getStats(textOrHtml);

  let score = 0;

  if (stats.wordCount >= 900) score += 1;
  if (stats.wordCount >= 1600) score += 1;
  if (stats.averageSentenceLength >= 18) score += 1;
  if (stats.averageSentenceLength >= 28) score += 1;
  if (stats.averageWordLength >= 5.4) score += 1;
  if (stats.averageWordLength >= 6.4) score += 1;
  if (stats.punctuationDensity >= 0.035) score += 1;
  if (stats.punctuationDensity >= 0.07) score += 1;

  const level: DifficultyLevel = score >= 4 ? "Hard" : score >= 2 ? "Medium" : "Easy";

  return {
    level,
    reason: getDifficultyReason(stats, score),
  };
}
