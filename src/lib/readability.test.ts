import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateDifficultyFromText,
  estimateReadingMinutes,
  getPlainWordCount,
} from "./readability";

test("getPlainWordCount counts visible words from plain text and HTML", () => {
  assert.equal(
    getPlainWordCount("<article><h1>Markets rally today</h1><p>The quick brown fox jumps.</p></article>"),
    8
  );
  assert.equal(getPlainWordCount("Don't split well-known words apart."), 5);
});

test("estimateReadingMinutes rounds up from a lightweight reading speed", () => {
  assert.equal(estimateReadingMinutes(0), 1);
  assert.equal(estimateReadingMinutes(220), 1);
  assert.equal(estimateReadingMinutes(221), 2);
});

test("estimateDifficultyFromText marks short simple copy as easy", () => {
  const result = estimateDifficultyFromText(
    "The team won today. Fans were happy. The coach praised the players."
  );

  assert.equal(result.level, "Easy");
  assert.match(result.reason, /short sentences/i);
});

test("estimateDifficultyFromText marks dense complex copy as hard", () => {
  const result = estimateDifficultyFromText(`
    Monetary policymakers, confronting persistent inflationary expectations and volatile
    cross-border capital movements, emphasized that tightening conditions could continue;
    however, analysts questioned whether households, businesses, and highly leveraged
    borrowers would absorb the cumulative pressure without wider financial disruption.
  `);

  assert.equal(result.level, "Hard");
  assert.match(result.reason, /long sentences|advanced vocabulary|dense punctuation/i);
});
