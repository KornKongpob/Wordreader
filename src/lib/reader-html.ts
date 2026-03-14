import { normalizeLookupText } from "@/lib/lookup";
import {
  READER_ALLOWED_ATTR,
  READER_ALLOWED_TAGS,
  READER_FORBIDDEN_TAGS,
  sanitizeDimensionValue,
  sanitizeSrcSetValue,
  sanitizeUrlValue,
} from "@/lib/reader-html-config";
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

const ALLOWED_TAG_SET = new Set(READER_ALLOWED_TAGS);
const ALLOWED_ATTR_SET = new Set(READER_ALLOWED_ATTR);
const FORBIDDEN_TAG_SET = new Set(READER_FORBIDDEN_TAGS);

export function sanitizeReaderHtml(content: string) {
  if (typeof DOMParser === "undefined") {
    return content;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="reader-root">${content || ""}</div>`, "text/html");
  const root = doc.getElementById("reader-root");
  if (!root) return "";

  const elements = [...root.querySelectorAll("*")];
  for (const element of elements) {
    const tagName = element.tagName.toLowerCase();

    if (FORBIDDEN_TAG_SET.has(tagName as (typeof READER_FORBIDDEN_TAGS)[number])) {
      element.remove();
      continue;
    }

    if (!ALLOWED_TAG_SET.has(tagName as (typeof READER_ALLOWED_TAGS)[number])) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (
        !ALLOWED_ATTR_SET.has(name as (typeof READER_ALLOWED_ATTR)[number]) ||
        name.startsWith("on") ||
        name === "style"
      ) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === "href" || name === "src") {
        const safeValue = sanitizeUrlValue(attribute.value);
        if (!safeValue) {
          element.removeAttribute(attribute.name);
        } else {
          element.setAttribute(attribute.name, safeValue);
        }
        continue;
      }

      if (name === "srcset") {
        const safeValue = sanitizeSrcSetValue(attribute.value);
        if (!safeValue) {
          element.removeAttribute(attribute.name);
        } else {
          element.setAttribute(attribute.name, safeValue);
        }
        continue;
      }

      if (name === "width" || name === "height") {
        const safeValue = sanitizeDimensionValue(attribute.value);
        if (!safeValue) {
          element.removeAttribute(attribute.name);
        } else {
          element.setAttribute(attribute.name, safeValue);
        }
      }
    }

    if (tagName === "a") {
      const href = element.getAttribute("href");
      if (!href) {
        element.replaceWith(...Array.from(element.childNodes));
        continue;
      }
      if (element.getAttribute("target") === "_blank") {
        element.setAttribute("rel", "noopener noreferrer");
      } else {
        element.removeAttribute("target");
        element.removeAttribute("rel");
      }
    }

    if (tagName === "img") {
      if (!element.getAttribute("src")) {
        element.remove();
        continue;
      }
      if (!element.getAttribute("alt")) {
        element.setAttribute("alt", "");
      }
      element.setAttribute("loading", "lazy");
    }
  }

  return root.innerHTML;
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
        span.dataset.readerIgnoreSelection = "true";
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
