"use client";

import Image from "next/image";
import { useState } from "react";
import { CloudOff, ExternalLink } from "lucide-react";
import ReaderControls from "./ReaderControls";
import type { OfflineArticleRecord } from "@/lib/offline";

interface OfflineReaderViewProps {
  article: OfflineArticleRecord;
}

function getStoredFontSize() {
  if (typeof window === "undefined") return 18;
  const savedFontSize = localStorage.getItem("readerFontSize");
  return savedFontSize ? parseInt(savedFontSize, 10) : 18;
}

function getStoredLineSpacing() {
  if (typeof window === "undefined") return 1.6;
  const savedLineSpacing = localStorage.getItem("readerLineSpacing");
  return savedLineSpacing ? parseFloat(savedLineSpacing) : 1.6;
}

function getStoredLookupMode(): "word" | "phrase" {
  if (typeof window === "undefined") return "phrase";
  const stored = localStorage.getItem("readerLookupMode");
  return stored === "word" || stored === "phrase" ? stored : "phrase";
}

export default function OfflineReaderView({ article }: OfflineReaderViewProps) {
  const [fontSize, setFontSize] = useState(getStoredFontSize);
  const [lineSpacing, setLineSpacing] = useState(getStoredLineSpacing);
  const [lookupMode, setLookupMode] = useState<"word" | "phrase">(getStoredLookupMode);

  const formattedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
    localStorage.setItem("readerFontSize", size.toString());
  };

  const handleLineSpacingChange = (spacing: number) => {
    setLineSpacing(spacing);
    localStorage.setItem("readerLineSpacing", spacing.toString());
  };

  const handleLookupModeChange = (mode: "word" | "phrase") => {
    setLookupMode(mode);
    localStorage.setItem("readerLookupMode", mode);
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <ReaderControls
        fontSize={fontSize}
        lineSpacing={lineSpacing}
        lookupMode={lookupMode}
        onFontSizeChange={handleFontSizeChange}
        onLineSpacingChange={handleLineSpacingChange}
        onLookupModeChange={handleLookupModeChange}
      />

      <article className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        <div className="mb-6 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <CloudOff size={18} />
            </div>
            <div>
              <p className="font-medium">Offline copy</p>
              <p className="mt-1 text-sm text-muted">
                This saved version stays readable without a network connection. Word lookup and sync features resume when you&apos;re back online.
              </p>
            </div>
          </div>
        </div>

        <header className="mb-6">
          <h1
            className="mb-3 font-bold leading-tight"
            style={{ fontSize: fontSize + 6 }}
          >
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="font-medium text-primary">{article.source_name}</span>
            {article.author && <span>{article.author}</span>}
            {formattedDate && <span>{formattedDate}</span>}
          </div>

          {!article.url.startsWith("wordreader://") && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted transition hover:text-primary"
            >
              View original <ExternalLink size={12} />
            </a>
          )}
        </header>

        {article.image_url && (
          <div className="mb-6 overflow-hidden sm:rounded-xl">
            <Image
              src={article.image_url}
              alt={article.title}
              width={1200}
              height={675}
              sizes="(max-width: 640px) 100vw, 768px"
              className="h-auto max-h-80 w-full object-cover"
              unoptimized
            />
          </div>
        )}

        <div
          className="article-content prose max-w-none dark:prose-invert"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: lineSpacing,
          }}
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </article>
    </div>
  );
}
