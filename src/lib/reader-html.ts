import DOMPurify from "isomorphic-dompurify";
import { normalizeLookupText } from "@/lib/lookup";
import type { DetectedIdiom, SavedVocabularyPreview } from "@/types";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function toSavedWordKey(value: string) {
  return normalizeLookupText(value).toLowerCase();
}

function toIdiomKey(value: string) {
  return normalizeLookupText(value).toLowerCase();
}

export function sanitizeReaderHtml(content: string) {
  return DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true },
    ADD_ATTR: [
      "data-meaning",
      "data-phrase",
      "data-type",
      "data-word",
      "data-reader-collocation",
      "data-reader-separator",
    ],
  });
}

function highlightSavedWords(
  content: string,
  savedItems: SavedVocabularyPreview[],
  activeWordKey?: string | null
) {
  if (typeof DOMParser === "undefined" || savedItems.length === 0) {
    return content;
  }

  const normalizedWords = [...new Set(savedItems.map((item) => item.word))]
    .map((word) => normalizeLookupText(word))
    .filter((word) => word.length >= 3)
    .sort((a, b) => b.length - a.length)
    .slice(0, 80);

  if (normalizedWords.length === 0) {
    return content;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="reader-root">${content}</div>`, "text/html");
  const root = doc.getElementById("reader-root");
  if (!root) return content;

  const regex = new RegExp(`(${normalizedWords.map(escapeRegex).join("|")})`, "gi");
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parentElement = node.parentElement;
    const parentTag = parentElement?.tagName.toLowerCase();

    if (!parentTag || ["script", "style", "mark", "a"].includes(parentTag)) {
      continue;
    }

    if (parentElement?.closest(".idiom-highlight")) {
      continue;
    }

    if (regex.test(node.textContent || "")) {
      nodes.push(node);
    }

    regex.lastIndex = 0;
  }

  for (const node of nodes) {
    const text = node.textContent || "";
    const fragment = doc.createDocumentFragment();
    let lastIndex = 0;

    text.replace(regex, (match, _capture, offset) => {
      if (offset > lastIndex) {
        fragment.append(doc.createTextNode(text.slice(lastIndex, offset)));
      }

      const mark = doc.createElement("mark");
      const wordKey = toSavedWordKey(match);
      mark.className = wordKey === activeWordKey ? "reader-saved-word is-active" : "reader-saved-word";
      mark.dataset.word = wordKey;
      mark.textContent = match;
      fragment.append(mark);
      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < text.length) {
      fragment.append(doc.createTextNode(text.slice(lastIndex)));
    }

    node.parentNode?.replaceChild(fragment, node);
  }

  return root.innerHTML;
}

function highlightIdiomPhrases(content: string, idioms: DetectedIdiom[]) {
  if (typeof DOMParser === "undefined" || idioms.length === 0) {
    return content;
  }

  const uniqueIdioms = idioms
    .filter(
      (item, index, items) =>
        items.findIndex((candidate) => toIdiomKey(candidate.phrase) === toIdiomKey(item.phrase)) === index
    )
    .sort((a, b) => b.phrase.length - a.phrase.length);

  if (uniqueIdioms.length === 0) {
    return content;
  }

  const idiomMap = new Map(uniqueIdioms.map((item) => [toIdiomKey(item.phrase), item]));
  const regex = new RegExp(
    `(${uniqueIdioms
      .map((item) => escapeRegex(normalizeLookupText(item.phrase)).replace(/\\ /g, "\\s+"))
      .join("|")})`,
    "gi"
  );

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="reader-root">${content}</div>`, "text/html");
  const root = doc.getElementById("reader-root");
  if (!root) return content;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parentElement = node.parentElement;
    const parentTag = parentElement?.tagName.toLowerCase();

    if (!parentTag || ["script", "style", "mark", "a"].includes(parentTag)) {
      continue;
    }

    if (parentElement?.closest(".idiom-highlight")) {
      continue;
    }

    if (regex.test(node.textContent || "")) {
      nodes.push(node);
    }

    regex.lastIndex = 0;
  }

  for (const node of nodes) {
    const text = node.textContent || "";
    const fragment = doc.createDocumentFragment();
    let lastIndex = 0;

    text.replace(regex, (match, _capture, offset) => {
      if (offset > lastIndex) {
        fragment.append(doc.createTextNode(text.slice(lastIndex, offset)));
      }

      const idiom = idiomMap.get(toIdiomKey(match));
      if (idiom) {
        const span = doc.createElement("span");
        span.className = "idiom-highlight";
        span.dataset.meaning = idiom.meaning;
        span.dataset.type = idiom.type;
        span.dataset.phrase = idiom.phrase;
        span.textContent = match;
        fragment.append(span);
      } else {
        fragment.append(doc.createTextNode(match));
      }

      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < text.length) {
      fragment.append(doc.createTextNode(text.slice(lastIndex)));
    }

    node.parentNode?.replaceChild(fragment, node);
  }

  return root.innerHTML;
}

export function buildReaderDisplayHtml({
  content,
  savedItems = [],
  activeWordKey = null,
  idioms = [],
}: {
  content: string;
  savedItems?: SavedVocabularyPreview[];
  activeWordKey?: string | null;
  idioms?: DetectedIdiom[];
}) {
  const sanitizedContent = sanitizeReaderHtml(content);
  const idiomEnhancedContent =
    idioms.length > 0 ? highlightIdiomPhrases(sanitizedContent, idioms) : sanitizedContent;

  return savedItems.length > 0
    ? highlightSavedWords(idiomEnhancedContent, savedItems, activeWordKey)
    : idiomEnhancedContent;
}

export function getPlainTextFromHtml(content: string) {
  const sanitizedContent = sanitizeReaderHtml(content);

  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${sanitizedContent}</div>`, "text/html");
    return doc.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }

  return sanitizedContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
