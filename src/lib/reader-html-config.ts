export const READER_ALLOWED_TAGS = [
  "a",
  "article",
  "aside",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "section",
  "span",
  "strong",
  "time",
  "ul",
] as const;

export const READER_ALLOWED_ATTR = [
  "alt",
  "class",
  "data-meaning",
  "data-phrase",
  "data-reader-collocation",
  "data-reader-ignore-selection",
  "data-reader-separator",
  "data-type",
  "data-word",
  "height",
  "href",
  "loading",
  "rel",
  "sizes",
  "src",
  "srcset",
  "target",
  "title",
  "width",
] as const;

export const READER_FORBIDDEN_TAGS = [
  "form",
  "iframe",
  "input",
  "object",
  "script",
  "style",
  "svg",
] as const;

const SAFE_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function sanitizeUrlValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    return SAFE_URL_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function sanitizeSrcSetValue(value: string) {
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [url, descriptor] = entry.split(/\s+/, 2);
      const safeUrl = sanitizeUrlValue(url);
      if (!safeUrl) return null;
      return descriptor ? `${safeUrl} ${descriptor}` : safeUrl;
    })
    .filter((entry): entry is string => Boolean(entry));

  return entries.length > 0 ? entries.join(", ") : null;
}

export function sanitizeDimensionValue(value: string) {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? trimmed : null;
}
