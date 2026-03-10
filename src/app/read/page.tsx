"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import {
  AlertCircle,
  BookOpen,
  BookOpenText,
  FileText,
  Globe,
  Loader2,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getOfflineArticles, type OfflineArticleRecord } from "@/lib/offline";

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

function formatRelativeTime(value?: string) {
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

export default function ReadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<ImportMode>("url");
  const [url, setUrl] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualSource, setManualSource] = useState("Personal import");
  const [manualUrl, setManualUrl] = useState("");
  const [manualText, setManualText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentArticles, setRecentArticles] = useState<RecentArticle[]>([]);
  const [offlineArticles, setOfflineArticles] = useState<OfflineArticleRecord[]>([]);

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

  const saveArticleAndOpen = async (article: {
    url: string;
    title: string;
    source_name: string;
    author: string | null;
    published_at: string | null;
    image_url: string | null;
    content: string;
    description?: string;
  }) => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured. Check environment variables.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Please sign in again to continue.");
      return;
    }

    const { data: existing } = await supabase
      .from("articles")
      .select("id")
      .eq("url", article.url)
      .maybeSingle();

    let articleId = existing?.id;

    if (!articleId) {
      const { data: inserted, error: insertError } = await supabase
        .from("articles")
        .insert({
          url: article.url,
          title: article.title,
          description: article.description ?? "",
          source_name: article.source_name,
          author: article.author,
          published_at: article.published_at,
          image_url: article.image_url,
          content: article.content,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        setError("Could not save this article. Please try again.");
        return;
      }

      articleId = inserted.id;
    }

    await supabase.from("reading_history").upsert(
      {
        user_id: user.id,
        article_id: articleId,
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,article_id" }
    );

    router.push(`/read/${articleId}`);
  };

  const handleUrlSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      await saveArticleAndOpen(data.article);
    } catch {
      setError("Network error. Please check your connection and try again.");
    }

    setLoading(false);
  };

  const handleManualSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

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
    } catch {
      setError("Could not import this text right now.");
    }

    setLoading(false);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-5 py-6">
        <section className="glass-hero mb-6 rounded-[2rem] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Upload size={18} className="text-primary" />
            <div>
              <p className="editorial-label mb-1">Import A Story</p>
              <h1 className="text-xl font-bold">Read an article</h1>
              <p className="text-sm text-muted">
                Bring in a URL or paste text you want to study.
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
                URL import
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
                placeholder="https://edition.cnn.com/2026/..."
                required
                disabled={loading}
                className="glass-input w-full rounded-xl px-4 py-3.5 text-[16px] text-foreground outline-none transition focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="glow-button flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-medium text-primary-foreground transition hover:opacity-95 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Extracting article...
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
                disabled={loading}
                className="glass-input w-full rounded-xl px-4 py-3 text-[16px] outline-none transition focus:ring-2 focus:ring-primary/40"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={manualSource}
                  onChange={(event) => setManualSource(event.target.value)}
                  placeholder="Source name"
                  disabled={loading}
                  className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/40"
                />
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(event) => setManualUrl(event.target.value)}
                  placeholder="Original URL (optional)"
                  disabled={loading}
                  className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <textarea
                value={manualText}
                onChange={(event) => setManualText(event.target.value)}
                placeholder="Paste the article text here. Leave blank lines between paragraphs if possible."
                required
                disabled={loading}
                className="glass-input min-h-40 w-full rounded-xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="submit"
                disabled={loading || !manualTitle.trim() || !manualText.trim()}
                className="glow-button flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-medium text-primary-foreground transition hover:opacity-95 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Importing text...
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

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>

        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
              Continue reading
            </h2>
            <span className="text-xs text-muted">{continueReading.length} in progress</span>
          </div>
          {continueReading.length === 0 ? (
            <div className="glass-panel rounded-2xl p-5 text-center">
              <p className="font-medium">No active article yet</p>
              <p className="mt-1 text-sm text-muted">
                Imported articles will show up here so you can jump back in quickly.
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-primary">
                          {articleMeta?.source_name ?? "Article"}
                        </p>
                        <p className="mt-1 font-semibold leading-snug">
                          {articleMeta?.title ?? "Untitled article"}
                        </p>
                      </div>
                      <span className="glass-chip rounded-full px-3 py-1 text-xs text-muted">
                        Resume
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted">
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
              Offline library
            </h2>
            <span className="text-xs text-muted">{offlineArticles.length} cached</span>
          </div>
          {offlineArticles.length === 0 ? (
            <div className="glass-panel rounded-2xl p-5 text-center">
              <p className="font-medium">No offline copies yet</p>
              <p className="mt-1 text-sm text-muted">
                Turn on offline mode in settings, then open articles to cache them.
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
                  <p className="text-xs uppercase tracking-wide text-primary">
                    {article.source_name}
                  </p>
                  <p className="mt-1 font-semibold leading-snug">{article.title}</p>
                  <p className="mt-2 text-xs text-muted">
                    Cached {formatRelativeTime(article.cached_at).replace("Updated ", "")}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
