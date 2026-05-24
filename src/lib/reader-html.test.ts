import assert from "node:assert/strict";
import test from "node:test";
import { DOMParser, parseHTML } from "linkedom";
import { buildReaderDisplayHtml } from "./reader-html";
import type { SavedVocabularyPreview } from "@/types";

globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser;
globalThis.NodeFilter = { SHOW_TEXT: 4 } as typeof NodeFilter;

function savedWord(word: string): SavedVocabularyPreview {
  return {
    id: word,
    word,
    thai_meaning: word,
    english_meaning: word,
    part_of_speech: "noun",
    difficulty: "medium",
  };
}

function markCount(html: string) {
  const { document } = parseHTML(`<div>${html}</div>`);
  return document.querySelectorAll("mark[data-word]").length;
}

test("saved single words do not highlight substrings or word compounds", () => {
  const html = buildReaderDisplayHtml({
    content: "<p>The article mentions art, market, market. market's market-based.</p>",
    savedItems: [savedWord("art"), savedWord("market")],
  });

  const { document } = parseHTML(`<div>${html}</div>`);
  const marks = [...document.querySelectorAll("mark[data-word]")].map((node) => ({
    key: node.getAttribute("data-word"),
    text: node.textContent,
  }));

  assert.deepEqual(marks, [
    { key: "art", text: "art" },
    { key: "market", text: "market" },
    { key: "market", text: "market" },
  ]);
  assert.equal(
    document.querySelector("div")?.textContent,
    "The article mentions art, market, market. market's market-based."
  );
});

test("saved multi-word phrases match flexible whitespace and take priority", () => {
  const html = buildReaderDisplayHtml({
    content: "<p>The interest   rate changed after the rate decision.</p>",
    savedItems: [savedWord("rate"), savedWord("interest rate")],
    activeWordKey: "interest rate",
  });

  const { document } = parseHTML(`<div>${html}</div>`);
  const marks = [...document.querySelectorAll("mark[data-word]")].map((node) => ({
    key: node.getAttribute("data-word"),
    text: node.textContent,
    active: node.classList.contains("is-active"),
  }));

  assert.deepEqual(marks, [
    { key: "interest rate", text: "interest   rate", active: true },
    { key: "rate", text: "rate", active: false },
  ]);
});

test("saved phrases do not wrap existing idiom highlights", () => {
  const html = buildReaderDisplayHtml({
    content: "<p>They set up a new office.</p>",
    savedItems: [savedWord("set up")],
    idioms: [{ phrase: "set up", meaning: "set up", type: "phrasal_verb" }],
  });

  assert.equal(markCount(html), 0);
  assert.match(html, /class="idiom-highlight"/);
});
