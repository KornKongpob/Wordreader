import { extract, extractFromHtml } from "@extractus/article-extractor";
import { sanitizeReaderHtmlForServer } from "@/lib/reader-html-server";
import { validatePublicArticleUrl } from "@/lib/safe-url";
import type { ExtractedArticle } from "@/types";

const MAX_PREFETCH_BYTES = 5 * 1024 * 1024;

class RejectedArticleFetchError extends Error {}

function getFetchOptions(url: string) {
  const headers = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9,th;q=0.8",
    "cache-control": "no-cache",
    pragma: "no-cache",
    referer: new URL(url).origin,
  };

  return {
    headers,
    signal: AbortSignal.timeout(15000),
  };
}

function isHtmlContentType(contentType: string | null) {
  if (!contentType) return true;

  const normalized = contentType.toLowerCase();
  return (
    normalized.includes("text/html") ||
    normalized.includes("application/xhtml+xml")
  );
}

function getContentLength(response: Response) {
  const value = response.headers.get("content-length");
  if (!value) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function readResponseTextWithLimit(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) {
    return response.text();
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    received += value.byteLength;
    if (received > MAX_PREFETCH_BYTES) {
      throw new RejectedArticleFetchError("Article response is too large.");
    }

    chunks.push(value);
  }

  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

async function loadArticleForExtraction(url: string) {
  const initialValidation = await validatePublicArticleUrl(url);
  if (!initialValidation.ok) {
    return { article: null, finalUrl: url };
  }

  const safeUrl = initialValidation.url;
  const fetchOptions = getFetchOptions(safeUrl);

  try {
    const response = await fetch(safeUrl, {
      headers: fetchOptions.headers,
      signal: fetchOptions.signal,
      redirect: "follow",
    });

    const finalValidation = await validatePublicArticleUrl(
      response.url || safeUrl
    );
    if (!finalValidation.ok) {
      throw new RejectedArticleFetchError("Redirected URL is not public.");
    }

    if (response.ok) {
      if (!isHtmlContentType(response.headers.get("content-type"))) {
        throw new RejectedArticleFetchError("Article response is not HTML.");
      }

      const contentLength = getContentLength(response);
      if (contentLength !== null && contentLength > MAX_PREFETCH_BYTES) {
        throw new RejectedArticleFetchError("Article response is too large.");
      }

      const html = await readResponseTextWithLimit(response);
      const article = await extractFromHtml(html, finalValidation.url);
      if (article?.content) {
        return { article, finalUrl: finalValidation.url };
      }
    }
  } catch (error) {
    if (error instanceof RejectedArticleFetchError) {
      throw error;
    }

    console.warn("HTML prefetch extraction failed, falling back:", error);
  }

  const article = await extract(safeUrl, {}, fetchOptions);
  if (article?.url) {
    const finalValidation = await validatePublicArticleUrl(article.url);
    if (!finalValidation.ok) {
      throw new RejectedArticleFetchError("Extracted URL is not public.");
    }

    return { article, finalUrl: finalValidation.url };
  }

  return { article, finalUrl: safeUrl };
}

export async function extractArticle(
  url: string
): Promise<ExtractedArticle | null> {
  try {
    const { article, finalUrl } = await loadArticleForExtraction(url);

    if (!article || !article.content) {
      return null;
    }

    // Determine source name from URL
    let sourceName = "Unknown";
    try {
      const parsed = new URL(finalUrl);
      if (parsed.hostname.includes("cnn.com")) {
        sourceName = "CNN";
      } else {
        sourceName = parsed.hostname.replace("www.", "");
      }
    } catch {
      // Keep default
    }

    return {
      url: finalUrl,
      title: article.title || "Untitled Article",
      description: article.description || "",
      source_name: sourceName,
      author: article.author || null,
      published_at: article.published || null,
      image_url: article.image || null,
      content: sanitizeReaderHtmlForServer(article.content),
    };
  } catch (error) {
    console.error("Article extraction failed:", error);
    return null;
  }
}
