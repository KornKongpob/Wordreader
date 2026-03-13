import { extract, extractFromHtml } from "@extractus/article-extractor";
import { sanitizeReaderHtml } from "@/lib/reader-html";
import type { ExtractedArticle } from "@/types";

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

async function loadArticleForExtraction(url: string) {
  const fetchOptions = getFetchOptions(url);

  try {
    const response = await fetch(url, {
      headers: fetchOptions.headers,
      signal: fetchOptions.signal,
      redirect: "follow",
    });

    if (response.ok) {
      const html = await response.text();
      const article = await extractFromHtml(html, response.url || url);
      if (article?.content) {
        return { article, finalUrl: response.url || url };
      }
    }
  } catch (error) {
    console.warn("HTML prefetch extraction failed, falling back:", error);
  }

  const article = await extract(url, {}, fetchOptions);
  return { article, finalUrl: url };
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
      content: sanitizeReaderHtml(article.content),
    };
  } catch (error) {
    console.error("Article extraction failed:", error);
    return null;
  }
}
