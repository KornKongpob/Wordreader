export interface DictationComparison {
  score: number;
  missing: string[];
  extra: string[];
}

function toWords(text: string) {
  const normalized = normalizeForDictation(text);
  return normalized ? normalized.split(" ") : [];
}

function buildMatchMatrix(expectedWords: string[], actualWords: string[]) {
  const matrix = Array.from({ length: expectedWords.length + 1 }, () =>
    Array(actualWords.length + 1).fill(0) as number[]
  );

  for (let expectedIndex = expectedWords.length - 1; expectedIndex >= 0; expectedIndex -= 1) {
    for (let actualIndex = actualWords.length - 1; actualIndex >= 0; actualIndex -= 1) {
      matrix[expectedIndex][actualIndex] =
        expectedWords[expectedIndex] === actualWords[actualIndex]
          ? matrix[expectedIndex + 1][actualIndex + 1] + 1
          : Math.max(
              matrix[expectedIndex + 1][actualIndex],
              matrix[expectedIndex][actualIndex + 1]
            );
    }
  }

  return matrix;
}

export function normalizeForDictation(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/(?<=\d)[.,](?=\d)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compareDictation(expected: string, actual: string): DictationComparison {
  const expectedWords = toWords(expected);
  const actualWords = toWords(actual);

  if (expectedWords.length === 0) {
    return {
      score: actualWords.length === 0 ? 100 : 0,
      missing: [],
      extra: actualWords,
    };
  }

  const matrix = buildMatchMatrix(expectedWords, actualWords);
  const matchedExpected = new Set<number>();
  const matchedActual = new Set<number>();
  let expectedIndex = 0;
  let actualIndex = 0;

  while (expectedIndex < expectedWords.length && actualIndex < actualWords.length) {
    if (expectedWords[expectedIndex] === actualWords[actualIndex]) {
      matchedExpected.add(expectedIndex);
      matchedActual.add(actualIndex);
      expectedIndex += 1;
      actualIndex += 1;
    } else if (
      matrix[expectedIndex + 1][actualIndex] >= matrix[expectedIndex][actualIndex + 1]
    ) {
      expectedIndex += 1;
    } else {
      actualIndex += 1;
    }
  }

  const missing = expectedWords.filter((_word, index) => !matchedExpected.has(index));
  const extra = actualWords.filter((_word, index) => !matchedActual.has(index));
  const score = Math.round((matchedExpected.size / expectedWords.length) * 100);

  return {
    score,
    missing,
    extra,
  };
}
