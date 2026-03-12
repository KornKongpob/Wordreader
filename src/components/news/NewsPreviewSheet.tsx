"use client";

import Image from "next/image";
import { ExternalLink, Loader2, Newspaper, X } from "lucide-react";
import type { NewsFeedItem } from "@/types";

interface NewsPreviewSheetProps {
  item: NewsFeedItem;
  loading?: boolean;
  onRead: () => void;
  onClose: () => void;
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "Latest";

  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "Updated just now";
  if (diffHours < 24) return `Updated ${diffHours}h ago`;
  return `Updated ${Math.round(diffHours / 24)}d ago`;
}

export default function NewsPreviewSheet({
  item,
  loading = false,
  onRead,
  onClose,
}: NewsPreviewSheetProps) {
  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-slate-950/32 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="glass-panel-strong fixed bottom-0 left-0 right-0 z-[81] max-h-[88dvh] overflow-y-auto rounded-t-[2rem] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] animate-slide-up">
        <div className="mx-auto max-w-xl px-5 pb-6 pt-4">
          <div className="mb-3 flex justify-center">
            <div className="h-1 w-10 rounded-full bg-primary/20" />
          </div>

          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="editorial-label mb-2">Story Preview</p>
              <h3 className="text-safe-title text-xl font-semibold">{item.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="glass-chip rounded-full px-3 py-1 text-primary">
                  {item.source_name}
                </span>
                <span className="glass-chip rounded-full px-3 py-1 text-muted">
                  {formatRelativeTime(item.published_at)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="subtle-button shrink-0 rounded-xl p-2 text-muted transition hover:text-foreground"
              aria-label="Close story preview"
            >
              <X size={18} />
            </button>
          </div>

          {item.image_url ? (
            <div className="glass-panel mb-4 overflow-hidden rounded-[1.5rem] p-2">
              <Image
                src={item.image_url}
                alt={item.title}
                width={1200}
                height={675}
                sizes="(max-width: 640px) 100vw, 768px"
                className="h-auto max-h-80 w-full rounded-[1.15rem] object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="mb-4 flex min-h-44 items-center justify-center rounded-[1.6rem] border border-border/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(232,238,248,0.92))] text-primary shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:bg-[linear-gradient(135deg,rgba(18,24,37,0.94),rgba(12,18,28,0.94))]">
              <div className="glass-chip flex h-14 w-14 items-center justify-center rounded-[1.15rem] text-primary">
                <Newspaper size={24} />
              </div>
            </div>
          )}

          <div className="glass-panel rounded-[1.5rem] p-4">
            <p className="editorial-label mb-2">Why It Matters</p>
            <p className="text-safe-body text-sm text-muted">
              {item.description || "Open this article in the reader to get full text, lookups, and learning tools."}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onRead}
              disabled={loading}
              className="glow-button inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Newspaper size={18} />}
              {loading ? "Opening article..." : "Read article"}
            </button>

            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="subtle-button inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-foreground"
            >
              Open source site
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
