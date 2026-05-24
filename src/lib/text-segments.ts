export interface TextSentenceSegment {
  id: string;
  text: string;
  index: number;
}

const MIN_SENTENCE_LENGTH = 10;

function normalizeSentenceText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function shouldKeepSentence(text: string) {
  const normalized = normalizeSentenceText(text);
  return normalized.length >= MIN_SENTENCE_LENGTH && /[\p{L}\p{N}]/u.test(normalized);
}

function canUseSegmenter() {
  return typeof Intl !== "undefined" && "Segmenter" in Intl;
}

function extractWithSegmenter(text: string) {
  const Segmenter = Intl.Segmenter;
  const segmenter = new Segmenter("en", { granularity: "sentence" });

  return Array.from(segmenter.segment(text), (segment) => segment.segment);
}

function protectAbbreviations(text: string) {
  return text
    .replace(/\b([A-Z])\.([A-Z])\./g, "$1<dot>$2<dot>")
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St)\./g, "$1<dot>")
    .replace(/\b(Inc|Ltd|Co|Corp|vs)\./gi, "$1<dot>");
}

function restoreAbbreviations(text: string) {
  return text.replace(/<dot>/g, ".");
}

function extractWithFallback(text: string) {
  return protectAbbreviations(text)
    .split(/(?<=[.!?])\s+/)
    .map(restoreAbbreviations);
}

export function extractSentencesFromText(text: string): TextSentenceSegment[] {
  const source = normalizeSentenceText(text);
  if (!source) {
    return [];
  }

  const rawSegments = canUseSegmenter()
    ? extractWithSegmenter(source)
    : extractWithFallback(source);
  let index = 0;

  return rawSegments
    .map(normalizeSentenceText)
    .filter(shouldKeepSentence)
    .map((sentence) => {
      const segment = {
        id: `sentence-${index}`,
        text: sentence,
        index,
      };
      index += 1;
      return segment;
    });
}
