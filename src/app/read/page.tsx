"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import NewsPreviewSheet from "@/components/news/NewsPreviewSheet";
import { NEWS_SECTIONS } from "@/lib/news-sources";
import {
  estimateDifficultyFromText,
  estimateReadingMinutes,
  getPlainWordCount,
} from "@/lib/readability";
import { useArticleImport } from "@/hooks/useArticleImport";
import { useNewsFeed } from "@/hooks/useNewsFeed";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  BookOpenText,
  FileText,
  Globe,
  Loader2,
  Radio,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getOfflineArticles, type OfflineArticleRecord } from "@/lib/offline";
import type { NewsFeedItem } from "@/types";

interface RecentArticle {
  article_id: string;
  updated_at?: string;
  last_position?: number;
  is_finished?: boolean;
  articles?:
    | {
        id: string;
        title: string;
        source_name: string;
        image_url: string | null;
      }
    | {
        id: string;
        title: string;
        source_name: string;
        image_url: string | null;
      }[]
    | null;
}

type ImportMode = "url" | "text";

function formatRelativeTime(value?: string | null) {
  if (!value) return "Just added";

  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "Updated just now";
  if (diffHours < 24) return `Updated ${diffHours}h ago`;
  return `Updated ${Math.round(diffHours / 24)}d ago`;
}

function textToHtml(value: string) {
  return value
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) =>
      `<p>${paragraph
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br />")}</p>`
    )
    .join("");
}

function createManualUrl(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return `wordreader://manual/${slug || "article"}-${crypto.randomUUID()}`;
}

function getArticleMeta(entry: RecentArticle) {
  return Array.isArray(entry.articles) ? entry.articles[0] : entry.articles;
}

function getNewsLearningMeta(item: NewsFeedItem) {
  const previewText = `${item.title}. ${item.description}`;
  const wordCount = getPlainWordCount(previewText);

  return {
    readingMinutes: estimateReadingMinutes(wordCount),
    difficulty: estimateDifficultyFromText(previewText),
  };
}

export default function ReadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<ImportMode>("url");
  const [url, setUrl] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualSource, setManualSource] = useState("Personal import");
  const [manualUrl, setManualUrl] = useState("");
  const [manualText, setManualText] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [recentArticles, setRecentArticles] = useState<RecentArticle[]>([]);
  const [offlineArticles, setOfflineArticles] = useState<OfflineArticleRecord[]>([]);
  const [selectedNewsItem, setSelectedNewsItem] = useState<NewsFeedItem | null>(null);
  const { items: newsItems, warnings, loading: newsLoading, error: newsError } = useNewsFeed("all");
  const {
    importing,
    error: importError,
    setError,
    importFromUrl,
    saveArticleAndOpen,
  } = useArticleImport();

  useEffect(() => {
    const loadLibrary = async () => {
      setOfflineArticles(getOfflineArticles());

      const supabase = createClient();
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("reading_history")
        .select("article_id, updated_at, last_position, is_finished, articles(id, title, source_name, image_url)")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(8);

      const unique = new Map<string, RecentArticle>();
      for (const row of (data ?? []) as RecentArticle[]) {
        if (!unique.has(row.article_id)) {
          unique.set(row.article_id, row);
        }
      }

      setRecentArticles([...unique.values()]);
    };

    void loadLibrary();
  }, []);

  const continueReading = useMemo(
    () => recentArticles.filter((item) => !item.is_finished).slice(0, 4),
    [recentArticles]
  );
  const featuredStory = newsItems[0] ?? null;
  const topStories = useMemo(() => newsItems.slice(0, 5), [newsItems]);
  const featuredStoryMeta = featuredStory ? getNewsLearningMeta(featuredStory) : null;
  const isBusy = importing || manualSubmitting;

  const handleUrlSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await importFromUrl(url.trim());
    } catch {
      return;
    }
  };

  const handleManualSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setManualSubmitting(true);

    try {
      await saveArticleAndOpen({
        url: manualUrl.trim() || createManualUrl(manualTitle),
        title: manualTitle.trim(),
        description: "",
        source_name: manualSource.trim() || "Personal import",
        author: null,
        published_at: null,
        image_url: null,
        content: textToHtml(manualText),
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not import this text right now."
      );
    } finally {
      setManualSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-5 py-6">
        <section className="glass-hero mb-6 rounded-[2rem] p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-primary">
            <Radio size={16} />
            <span>Live discovery mode</span>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="editorial-label mb-2">Browse Today&apos;s News</p>
              <h1 className="text-safe-title text-3xl font-bold tracking-tight sm:text-4xl">
                Find current stories to learn from
              </h1>
              <p className="text-safe-body mt-3 text-sm text-muted sm:text-base">
                Browse fresh English headlines inside WordReader, preview the story,
                and open the ones you want to study without leaving the app.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:w-auto sm:grid-cols-4">
              {NEWS_SECTIONS.map((section) => (
                <div key={section.id} className="glass-panel rounded-[1.35rem] px-3 py-3">
                  <p className="editorial-label">{section.label}</p>
                  <p className="text-safe-meta mt-2 text-xs text-muted">
                    {section.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="editorial-label mb-1">Top Stories</p>
              <h2 className="text-safe-title text-xl font-semibold">Start with what&apos;s happening now</h2>
            </div>
            <span className="text-safe-meta text-xs text-muted">
              {newsLoading ? "Refreshing..." : `${topStories.length} live picks`}
            </span>
          </div>

          {newsLoading ? (
            <div className="glass-panel rounded-[2rem] p-6">
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 size={18} className="animate-spin" />
                Loading live headlines...
              </div>
            </div>
          ) : newsError ? (
            <div className="glass-panel rounded-[2rem] p-6">
              <p className="text-safe-body text-sm text-muted">{newsError}</p>
            </div>
          ) : !featuredStory ? (
            <div className="glass-panel rounded-[2rem] p-6">
              <p className="text-safe-body text-sm text-muted">
                Live headlines are unavailable right now. You can still import a URL below.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1.3fr,0.9fr]">
              <button
                type="button"
                onClick={() => setSelectedNewsItem(featuredStory)}
                className="glass-panel rounded-[2rem] p-5 text-left transition hover:-translate-y-0.5"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="glass-chip rounded-full px-3 py-1 text-primary">
                    {featuredStory.source_name}
                  </span>
                  <span>{formatRelativeTime(featuredStory.published_at)}</span>
                  {featuredStoryMeta && (
                    <>
                      <span className="glass-chip rounded-full px-3 py-1 text-muted">
                        {featuredStoryMeta.readingMinutes} min read
                      </span>
                      <span
                        className="glass-chip rounded-full px-3 py-1 text-muted"
                        title={featuredStoryMeta.difficulty.reason}
                      >
                        {featuredStoryMeta.difficulty.level}
                      </span>
                    </>
                  )}
                </div>
                <h3 className="text-safe-title text-2xl font-semibold">
                  {featuredStory.title}
                </h3>
                <p className="text-safe-body mt-3 text-sm text-muted">
                  {featuredStory.description}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
                  Open preview
                  <ArrowRight size={16} />
                </div>
              </button>

              <div className="grid gap-3">
                {topStories.slice(1).map((item) => {
                  const meta = getNewsLearningMeta(item);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedNewsItem(item)}
                      className="glass-panel rounded-[1.6rem] p-4 text-left transition hover:-translate-y-0.5"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="glass-chip rounded-full px-3 py-1 text-primary">
                          {item.source_name}
                        </span>
                        <span>{formatRelativeTime(item.published_at)}</span>
                        <span className="glass-chip rounded-full px-3 py-1 text-muted">
                          {meta.readingMinutes} min read
                        </span>
                        <span
                          className="glass-chip rounded-full px-3 py-1 text-muted"
                          title={meta.difficulty.reason}
                        >
                          {meta.difficulty.level}
                        </span>
                      </div>
                      <h3 className="text-safe-title line-clamp-3 font-semibold">{item.title}</h3>
                      <p className="text-safe-body mt-2 line-clamp-3 text-sm text-muted">
                        {item.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mt-3 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
              {warnings[0]}
            </div>
          )}
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-2">
          {NEWS_SECTIONS.map((section) => {
            const sectionItems = newsItems
              .filter((item) => item.category === section.id)
              .slice(0, 4);

            return (
              <div key={section.id} className="glass-panel rounded-[1.9rem] p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="editorial-label mb-1">{section.label}</p>
                    <h2 className="text-safe-title text-lg font-semibold">
                      {section.description}
                    </h2>
                  </div>
                  <span className="glass-chip rounded-full px-3 py-1 text-xs text-muted">
                    {sectionItems.length} picks
                  </span>
                </div>

                {sectionItems.length === 0 ? (
                  <p className="text-safe-body text-sm text-muted">
                    This section will refill as soon as fresh stories are available.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {sectionItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedNewsItem(item)}
                        className="w-full rounded-[1.4rem] border border-border/60 bg-white/60 px-4 py-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 dark:bg-white/4"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span className="glass-chip rounded-full px-3 py-1 text-primary">
                            {item.source_name}
                          </span>
                          <span>{formatRelativeTime(item.published_at)}</span>
                        </div>
                        <h3 className="text-safe-title line-clamp-2 font-semibold">{item.title}</h3>
                        <p className="text-safe-body mt-2 line-clamp-2 text-sm text-muted">
                          {item.description}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="glass-panel mb-6 rounded-[2rem] p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="glass-chip flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] text-primary">
              <Upload size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="editorial-label mb-1">Bring Your Own Article</p>
              <h2 className="text-safe-title text-xl font-semibold">Import by URL or pasted text</h2>
              <p className="text-safe-body mt-2 text-sm text-muted">
                If you already have a specific article in mind, import it here and open it straight in the reader.
              </p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("url")}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                mode === "url"
                  ? "glow-button text-primary-foreground"
                  : "subtle-button text-muted"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Globe size={14} />
                Paste URL
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                mode === "text"
                  ? "glow-button text-primary-foreground"
                  : "subtle-button text-muted"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <FileText size={14} />
                Paste text
              </span>
            </button>
          </div>

          {mode === "url" ? (
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/article"
                required
                disabled={isBusy}
                className="glass-input w-full rounded-xl px-4 py-3.5 text-[16px] text-foreground outline-none transition focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="submit"
                disabled={isBusy || !url.trim()}
                className="glow-button flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-medium text-primary-foreground transition hover:opacity-95 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Opening article...
                  </>
                ) : (
                  <>
                    <BookOpen size={18} />
                    Read from URL
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <input
                type="text"
                value={manualTitle}
                onChange={(event) => setManualTitle(event.target.value)}
                placeholder="Article title"
                required
                disabled={isBusy}
                className="glass-input w-full rounded-xl px-4 py-3 text-[16px] outline-none transition focus:ring-2 focus:ring-primary/40"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={manualSource}
                  onChange={(event) => setManualSource(event.target.value)}
                  placeholder="Source name"
                  disabled={isBusy}
                  className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/40"
                />
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(event) => setManualUrl(event.target.value)}
                  placeholder="Original URL (optional)"
                  disabled={isBusy}
                  className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <textarea
                value={manualText}
                onChange={(event) => setManualText(event.target.value)}
                placeholder="Paste the article text here. Leave blank lines between paragraphs if possible."
                required
                disabled={isBusy}
                className="glass-input min-h-40 w-full rounded-xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="submit"
                disabled={isBusy || !manualTitle.trim() || !manualText.trim()}
                className="glow-button flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-medium text-primary-foreground transition hover:opacity-95 disabled:opacity-50"
              >
                {manualSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Creating reader copy...
                  </>
                ) : (
                  <>
                    <BookOpenText size={18} />
                    Create reader copy
                  </>
                )}
              </button>
            </form>
          )}

          {importError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{importError}</span>
            </div>
          )}
        </section>

        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
              Continue reading
            </h2>
            <span className="text-safe-meta text-xs text-muted">
              {continueReading.length} in progress
            </span>
          </div>
          {continueReading.length === 0 ? (
            <div className="glass-panel rounded-2xl p-5 text-center">
              <p className="font-medium">No active article yet</p>
              <p className="mt-1 text-sm text-muted">
                Articles you open from the live feed will show up here for quick return visits.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {continueReading.map((item) => {
                const articleMeta = getArticleMeta(item);

                return (
                  <button
                    key={item.article_id}
                    type="button"
                    onClick={() => router.push(`/read/${item.article_id}`)}
                    className="glass-panel w-full rounded-2xl p-4 text-left transition active:scale-[0.98]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="chip-truncate inline-block max-w-full text-xs uppercase tracking-wide text-primary">
                          {articleMeta?.source_name ?? "Article"}
                        </p>
                        <p className="text-safe-title mt-1 line-clamp-2 font-semibold">
                          {articleMeta?.title ?? "Untitled article"}
                        </p>
                      </div>
                      <span className="glass-chip shrink-0 self-start rounded-full px-3 py-1 text-xs text-muted">
                        Resume
                      </span>
                    </div>
                    <p className="text-safe-meta mt-2 text-xs text-muted">
                      {formatRelativeTime(item.updated_at)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
              Saved reading history
            </h2>
            <span className="text-xs text-muted">{offlineArticles.length} saved</span>
          </div>
          {offlineArticles.length === 0 ? (
            <div className="glass-panel rounded-2xl p-5 text-center">
              <p className="font-medium">No saved reading copies yet</p>
              <p className="mt-1 text-sm text-muted">
                Articles you open get stored here so you can reopen them later, even when the original page is unavailable.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {offlineArticles.map((article) => (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => router.push(`/read/offline/${article.id}`)}
                  className="glass-panel w-full rounded-2xl p-4 text-left transition active:scale-[0.98]"
                >
                  <p className="chip-truncate inline-block max-w-full text-xs uppercase tracking-wide text-primary">
                    {article.source_name}
                  </p>
                  <p className="text-safe-title mt-1 line-clamp-2 font-semibold">
                    {article.title}
                  </p>
                  <p className="text-safe-body mt-2 text-xs text-muted">
                    Opens with the full reader when you&apos;re online, and falls back to the saved copy if needed.
                  </p>
                  <p className="text-safe-meta mt-2 text-xs text-muted">
                    Cached {formatRelativeTime(article.cached_at).replace("Updated ", "")}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedNewsItem && (
          <NewsPreviewSheet
            item={selectedNewsItem}
            loading={importing}
            onClose={() => {
              setSelectedNewsItem(null);
              setError(null);
            }}
            onRead={() => void importFromUrl(selectedNewsItem.url)}
          />
        )}
      </div>
    </AppShell>
  );
}
