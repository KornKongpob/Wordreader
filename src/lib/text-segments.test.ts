import assert from "node:assert/strict";
import test from "node:test";
import { extractSentencesFromText } from "./text-segments";

test("extractSentencesFromText returns indexed sentence segments", () => {
  const segments = extractSentencesFromText(
    "Markets rose today. Investors watched the central bank closely! More data arrives tomorrow?"
  );

  assert.deepEqual(segments, [
    { id: "sentence-0", text: "Markets rose today.", index: 0 },
    {
      id: "sentence-1",
      text: "Investors watched the central bank closely!",
      index: 1,
    },
    { id: "sentence-2", text: "More data arrives tomorrow?", index: 2 },
  ]);
});

test("extractSentencesFromText ignores very short fragments", () => {
  const segments = extractSentencesFromText("U.S. stocks rose. OK. A. The move surprised analysts.");

  assert.deepEqual(segments.map((segment) => segment.text), [
    "U.S. stocks rose.",
    "The move surprised analysts.",
  ]);
});

test("extractSentencesFromText normalizes whitespace", () => {
  const segments = extractSentencesFromText("First line wraps\ninto a sentence.   Second sentence follows.");

  assert.deepEqual(segments.map((segment) => segment.text), [
    "First line wraps into a sentence.",
    "Second sentence follows.",
  ]);
});
