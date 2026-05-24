"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BookOpenText, Loader2, Newspaper } from "lucide-react";
import NewsPreviewSheet from "@/components/news/NewsPreviewSheet";
import { useArticleImport } from "@/hooks/useArticleImport";
import { useNewsFeed } from "@/hooks/useNewsFeed";
import {
  estimateDifficultyFromText,
  estimateReadingMinutes,
  getPlainWordCount,
} from "@/lib/readability";
import type { NewsFeedItem } from "@/types";

function formatRelativeTime(value?: string | null) {
  if (!value) return "Latest";

  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "Updated just now";
  if (diffHours < 24) return `Updated ${diffHours}h ago`;
  return `Updated ${Math.round(diffHours / 24)}d ago`;
}

function getNewsLearningMeta(item: NewsFeedItem) {
  const previewText = `${item.title}. ${item.description}`;
  const wordCount = getPlainWordCount(previewText);

  return {
    readingMinutes: estimateReadingMinutes(wordCount),
    difficulty: estimateDifficultyFromText(previewText),
  };
}

export default function LatestHeadlines() {
  const { items, loading, error } = useNewsFeed("all");
  const { importing, error: importError, importFromUrl, setError } = useArticleImport();
  const [selectedItem, setSelectedItem] = useState<NewsFeedItem | null>(null);

  const featured = items[0] ?? null;
  const latestItems = useMemo(() => items.slice(1, 4), [items]);
  const featuredMeta = featured ? getNewsLearningMeta(featured) : null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="editorial-label mb-1">Live News</p>
          <h2 className="text-safe-title text-xl font-semibold">Latest headlines</h2>
        </div>
        <Link href="/read" className="text-sm font-medium text-primary hover:underline">
          Browse all
        </Link>
      </div>

      {loading ? (
        <div className="glass-panel rounded-[2rem] p-6">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={18} className="animate-spin" />
            Loading the latest headlines...
          </div>
        </div>
      ) : error ? (
        <div className="glass-panel rounded-[2rem] p-6">
          <p className="text-safe-body text-sm text-muted">{error}</p>
        </div>
      ) : !featured ? (
        <div className="glass-panel rounded-[2rem] p-6">
          <p className="text-safe-body text-sm text-muted">
            No fresh headlines are available right now.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => setSelectedItem(featured)}
            className="glass-panel overflow-hidden rounded-[2rem] text-left transition hover:-translate-y-0.5"
          >
            {featured.image_url ? (
              <Image
                src={featured.image_url}
                alt={featured.title}
                width={1200}
                height={675}
                sizes="(max-width: 640px) 100vw, 768px"
                className="h-52 w-full object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-52 items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(230,236,246,0.95))] dark:bg-[linear-gradient(135deg,rgba(18,24,37,0.94),rgba(12,18,28,0.94))]">
                <div className="glass-chip flex h-14 w-14 items-center justify-center rounded-[1.1rem] text-primary">
                  <Newspaper size={24} />
                </div>
              </div>
            )}

            <div className="p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="glass-chip rounded-full px-3 py-1 text-primary">
                  {featured.source_name}
                </span>
                <span>{formatRelativeTime(featured.published_at)}</span>
                {featuredMeta && (
                  <>
                    <span className="glass-chip rounded-full px-3 py-1 text-muted">
                      {featuredMeta.readingMinutes} min read
                    </span>
                    <span
                      className="glass-chip rounded-full px-3 py-1 text-muted"
                      title={featuredMeta.difficulty.reason}
                    >
                      {featuredMeta.difficulty.level}
                    </span>
                  </>
                )}
              </div>
              <h3 className="text-safe-title text-xl font-semibold">{featured.title}</h3>
              <p className="text-safe-body mt-2 text-sm text-muted">{featured.description}</p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
                <BookOpenText size={16} />
                Read in WordReader
              </div>
            </div>
          </button>

          <div className="grid gap-3 sm:grid-cols-3">
            {latestItems.map((item) => {
              const meta = getNewsLearningMeta(item);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="glass-panel rounded-[1.7rem] p-4 text-left transition hover:-translate-y-0.5"
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

      {importError && (
        <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {importError}
        </p>
      )}

      {selectedItem && (
        <NewsPreviewSheet
          item={selectedItem}
          loading={importing}
          onClose={() => {
            setSelectedItem(null);
            setError(null);
          }}
          onRead={() => void importFromUrl(selectedItem.url)}
        />
      )}
    </section>
  );
}
