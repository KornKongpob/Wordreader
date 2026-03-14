import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import {
  READER_ALLOWED_ATTR,
  READER_ALLOWED_TAGS,
  READER_FORBIDDEN_TAGS,
  sanitizeDimensionValue,
  sanitizeSrcSetValue,
  sanitizeUrlValue,
} from "@/lib/reader-html-config";

const ALLOWED_TAG_SET = new Set(READER_ALLOWED_TAGS);
const ALLOWED_ATTR_SET = new Set(READER_ALLOWED_ATTR);
const FORBIDDEN_TAG_SET = new Set(READER_FORBIDDEN_TAGS);

function sanitizeElementAttributes(
  $element: cheerio.Cheerio<AnyNode>,
  tagName: string
) {
  const attributes = { ...($element.attr() || {}) };

  for (const [name, rawValue] of Object.entries(attributes)) {
    const attrName = name.toLowerCase();
    if (
      !ALLOWED_ATTR_SET.has(attrName as (typeof READER_ALLOWED_ATTR)[number]) ||
      attrName.startsWith("on") ||
      attrName === "style"
    ) {
      $element.removeAttr(name);
      continue;
    }

    const value = typeof rawValue === "string" ? rawValue : "";
    if (attrName === "href" || attrName === "src") {
      const safeValue = sanitizeUrlValue(value);
      if (!safeValue) {
        $element.removeAttr(name);
      } else {
        $element.attr(name, safeValue);
      }
      continue;
    }

    if (attrName === "srcset") {
      const safeValue = sanitizeSrcSetValue(value);
      if (!safeValue) {
        $element.removeAttr(name);
      } else {
        $element.attr(name, safeValue);
      }
      continue;
    }

    if (attrName === "width" || attrName === "height") {
      const safeValue = sanitizeDimensionValue(value);
      if (!safeValue) {
        $element.removeAttr(name);
      } else {
        $element.attr(name, safeValue);
      }
      continue;
    }
  }

  if (tagName === "a") {
    const href = $element.attr("href");
    if (!href) {
      $element.replaceWith($element.contents());
      return;
    }

    if ($element.attr("target") === "_blank") {
      $element.attr("rel", "noopener noreferrer");
    } else {
      $element.removeAttr("target");
      $element.removeAttr("rel");
    }
  }

  if (tagName === "img") {
    if (!$element.attr("src")) {
      $element.remove();
      return;
    }
    if (!$element.attr("alt")) {
      $element.attr("alt", "");
    }
    $element.attr("loading", "lazy");
  }
}

export function sanitizeReaderHtmlForServer(content: string) {
  const $ = cheerio.load(`<div id="reader-root">${content || ""}</div>`);
  const root = $("#reader-root");

  root.find("*").each((_index, element) => {
    const tagName = element.tagName?.toLowerCase();
    if (!tagName) return;

    const $element = $(element);

    if (FORBIDDEN_TAG_SET.has(tagName as (typeof READER_FORBIDDEN_TAGS)[number])) {
      $element.remove();
      return;
    }

    if (!ALLOWED_TAG_SET.has(tagName as (typeof READER_ALLOWED_TAGS)[number])) {
      $element.replaceWith($element.contents());
      return;
    }

    sanitizeElementAttributes($element, tagName);
  });

  return root.html() || "";
}
