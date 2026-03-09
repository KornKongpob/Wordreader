import { extract } from "@extractus/article-extractor";
import type { ExtractedArticle } from "@/types";

// Validate that a URL is from CNN
export function isCNNUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "www.cnn.com" ||
      parsed.hostname === "cnn.com" ||
      parsed.hostname === "edition.cnn.com"
    );
  } catch {
    return false;
  }
}

// Extract article content from a URL using @extractus/article-extractor
export async function extractArticle(
  url: string
): Promise<ExtractedArticle | null> {
  try {
    const article = await extract(url);

    if (!article || !article.content) {
      return null;
    }

    // Determine source name from URL
    let sourceName = "Unknown";
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("cnn.com")) {
        sourceName = "CNN";
      } else {
        sourceName = parsed.hostname.replace("www.", "");
      }
    } catch {
      // Keep default
    }

    return {
      url: url,
      title: article.title || "Untitled Article",
      source_name: sourceName,
      author: article.author || null,
      published_at: article.published || null,
      image_url: article.image || null,
      content: article.content,
    };
  } catch (error) {
    console.error("Article extraction failed:", error);
    return null;
  }
}
