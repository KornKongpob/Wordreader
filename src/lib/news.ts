import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { NEWS_SOURCE_DEFINITIONS, type NewsSourceDefinition } from "@/lib/news-sources";
import type { NewsFeedItem, NewsSection } from "@/types";

const NEWS_FETCH_REVALIDATE_SEC = 15 * 60;

function createNewsId(sourceId: string, url: string) {
  return `${sourceId}:${Buffer.from(url).toString("base64url")}`;
}

function normalizeText(value?: string | null) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function stripHtml(value?: string | null) {
  if (!value) return "";
  const $ = cheerio.load(`<div>${value}</div>`);
  return normalizeText($.text());
}

function getFetchOptions(url: string): RequestInit {
  return {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9,th;q=0.8",
      "cache-control": "no-cache",
      pragma: "no-cache",
      referer: new URL(url).origin,
    },
    next: { revalidate: NEWS_FETCH_REVALIDATE_SEC },
  };
}

async function fetchMarkup(url: string) {
  const response = await fetch(url, getFetchOptions(url));

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.text();
}

function parseImageFromDescription(descriptionHtml: string) {
  const $ = cheerio.load(`<div>${descriptionHtml}</div>`);
  return (
    $("img").first().attr("src") ||
    $("img").first().attr("data-src") ||
    null
  );
}

function extractRssItemImage(
  $item: cheerio.Cheerio<AnyNode>,
  descriptionHtml: string
) {
  return (
    $item.find("media\\:thumbnail, thumbnail").first().attr("url") ||
    $item.find("media\\:content").first().attr("url") ||
    $item.find("enclosure").first().attr("url") ||
    parseImageFromDescription(descriptionHtml)
  );
}

async function fetchRssSource(source: NewsSourceDefinition): Promise<NewsFeedItem[]> {
  const markup = await fetchMarkup(source.url);
  const $ = cheerio.load(markup, { xmlMode: true });

  return $("item")
    .slice(0, source.limit)
    .toArray()
    .map((element) => {
      const $item = $(element);
      const descriptionHtml =
        $item.find("content\\:encoded").first().text() ||
        $item.find("description").first().text();
      const url = normalizeText(
        $item.find("link").first().text() || $item.find("guid").first().text()
      );

      return {
        id: createNewsId(source.id, url),
        title: normalizeText($item.find("title").first().text()) || "Untitled story",
        description:
          stripHtml(descriptionHtml) || `Latest update from ${source.label}.`,
        url,
        source_name: source.label,
        published_at: normalizeText(
          $item.find("pubDate").first().text() || $item.find("dc\\:date").first().text()
        ) || null,
        image_url: extractRssItemImage($item, descriptionHtml || ""),
        category: source.section,
      } satisfies NewsFeedItem;
    })
    .filter((item) => item.url);
}

function collectApArticleUrls(markup: string, baseUrl: string, limit: number) {
  const $ = cheerio.load(markup);
  const urls = new Set<string>();

  $("a[href*='/article/']").each((_index, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    const url = new URL(href, baseUrl).toString();
    if (!url.includes("/article/")) return;
    if (url.includes("/video/")) return;

    urls.add(url);
  });

  return [...urls].slice(0, limit);
}

async function fetchArticlePreview(
  url: string,
  source: NewsSourceDefinition
): Promise<NewsFeedItem | null> {
  const markup = await fetchMarkup(url);
  const $ = cheerio.load(markup);

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("title").first().text();
  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    $('meta[name="twitter:description"]').attr("content") ||
    "";
  const imageUrl =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    null;
  const publishedAt =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="article:published_time"]').attr("content") ||
    $("time").first().attr("datetime") ||
    null;

  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) {
    return null;
  }

  return {
    id: createNewsId(source.id, url),
    title: normalizedTitle,
    description: normalizeText(description) || `Latest update from ${source.label}.`,
    url,
    source_name: source.label,
    published_at: publishedAt ? normalizeText(publishedAt) : null,
    image_url: imageUrl ? normalizeText(imageUrl) : null,
    category: source.section,
  };
}

async function fetchApHubSource(source: NewsSourceDefinition): Promise<NewsFeedItem[]> {
  const markup = await fetchMarkup(source.url);
  const urls = collectApArticleUrls(markup, source.url, source.limit);

  const previews = await Promise.all(
    urls.map(async (url) => {
      try {
        return await fetchArticlePreview(url, source);
      } catch {
        return null;
      }
    })
  );

  return previews.filter((item): item is NewsFeedItem => Boolean(item));
}

async function fetchSourceItems(source: NewsSourceDefinition) {
  if (source.kind === "ap-hub") {
    return fetchApHubSource(source);
  }

  return fetchRssSource(source);
}

function sortNewsItems(a: NewsFeedItem, b: NewsFeedItem) {
  const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
  const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
  return bTime - aTime;
}

export async function fetchNewsFeed(section: NewsSection | "all") {
  const activeSources = NEWS_SOURCE_DEFINITIONS.filter((source) =>
    section === "all" ? true : source.section === section
  );

  const results = await Promise.allSettled(activeSources.map((source) => fetchSourceItems(source)));
  const warnings: string[] = [];
  const dedupedItems = new Map<string, NewsFeedItem>();

  results.forEach((result, index) => {
    const source = activeSources[index];
    if (result.status === "rejected") {
      warnings.push(`Could not load ${source.label} right now.`);
      return;
    }

    result.value.forEach((item) => {
      if (!dedupedItems.has(item.url)) {
        dedupedItems.set(item.url, item);
      }
    });
  });

  const items = [...dedupedItems.values()].sort(sortNewsItems);
  return {
    items,
    warnings,
  };
}
