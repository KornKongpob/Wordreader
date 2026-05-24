"use client";

import { useState } from "react";
import { BookOpenCheck, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { ArticleGuide as ArticleGuideData } from "@/types";

interface ArticleGuideProps {
  articleId: string;
  articleTitle: string;
  content: string;
}

interface ArticleGuideResponse {
  guide?: ArticleGuideData;
  error?: string;
}

export default function ArticleGuide({
  articleId,
  articleTitle,
  content,
}: ArticleGuideProps) {
  const [guide, setGuide] = useState<ArticleGuideData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadGuide = async () => {
    if (guide || loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/article-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId,
          articleTitle,
          content,
        }),
      });
      const data = (await response.json()) as ArticleGuideResponse;

      if (!response.ok || !data.guide) {
        setError(data.error || "Could not prepare this article guide.");
        return;
      }

      setGuide(data.guide);
    } catch {
      setError("Could not prepare this article guide right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);
    void loadGuide();
  };

  return (
    <section className="mt-5 border-t border-border/60 pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <BookOpenCheck size={18} className="mt-0.5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-safe-title text-sm font-semibold">Article Learning Guide</p>
            <p className="text-safe-meta mt-1 text-xs text-muted">
              Preview the key ideas, context, and vocabulary before reading.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          className="subtle-button inline-flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground disabled:opacity-60 sm:w-auto"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading
            ? "Preparing..."
            : expanded && guide
              ? "Hide guide"
              : guide
                ? "Show guide"
                : "Prepare me for this article"}
          {!loading && (expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {error && (
            <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          {loading && (
            <div className="flex items-center gap-2 py-3 text-sm text-muted">
              <Loader2 size={16} className="animate-spin" />
              <span>Preparing a mini lesson from this article...</span>
            </div>
          )}

          {guide && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="editorial-label">Quick Summary</p>
                <p className="text-safe-body text-sm leading-6 text-muted">
                  {guide.short_summary_th}
                </p>
              </div>

              <div className="space-y-1">
                <p className="editorial-label">Why It Matters</p>
                <p className="text-safe-body text-sm leading-6 text-muted">
                  {guide.why_it_matters_th}
                </p>
              </div>

              <div className="space-y-1">
                <p className="editorial-label">Background Context</p>
                <p className="text-safe-body text-sm leading-6 text-muted">
                  {guide.background_context_th}
                </p>
              </div>

              <div>
                <p className="editorial-label mb-2">Key Vocabulary</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {guide.key_vocabulary.map((item) => (
                    <div
                      key={`${item.word}-${item.thai_meaning}`}
                      className="rounded-xl border border-border/60 px-3 py-2"
                    >
                      <p className="text-safe-title text-sm font-semibold">{item.word}</p>
                      <p className="text-safe-body mt-1 text-sm text-muted">
                        {item.thai_meaning}
                      </p>
                      <p className="text-safe-meta mt-1 text-xs text-muted">
                        {item.simple_english_meaning}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="editorial-label mb-2">Reading Goals</p>
                <ul className="space-y-2">
                  {guide.reading_goals.map((goal, index) => (
                    <li
                      key={`${goal}-${index}`}
                      className="flex gap-2 text-safe-body text-sm leading-6 text-muted"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
