import assert from "node:assert/strict";
import test from "node:test";
import { compareDictation, normalizeForDictation } from "./text-compare";

test("normalizeForDictation lowercases and removes punctuation", () => {
  assert.equal(
    normalizeForDictation("Don't stop — the market rose 3.5%!"),
    "dont stop the market rose 35"
  );
});

test("compareDictation gives full credit for matching words despite case and punctuation", () => {
  assert.deepEqual(
    compareDictation("Markets rose today.", "markets rose today"),
    {
      score: 100,
      missing: [],
      extra: [],
    }
  );
});

test("compareDictation reports missing and extra words in order", () => {
  assert.deepEqual(
    compareDictation(
      "Markets rose today after inflation cooled.",
      "markets today after inflation cools"
    ),
    {
      score: 67,
      missing: ["rose", "cooled"],
      extra: ["cools"],
    }
  );
});
