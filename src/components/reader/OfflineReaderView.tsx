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

      <article className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-5">
        <div className="glass-panel rounded-[1.75rem] p-4">
          <div className="flex items-start gap-3">
            <div className="glass-chip rounded-[1.1rem] p-2 text-primary">
              <CloudOff size={18} />
            </div>
            <div>
              <p className="editorial-label mb-1">Offline Copy</p>
              <p className="font-medium">Saved for focus reading</p>
              <p className="mt-1 text-sm text-muted">
                This saved version stays readable without a network connection.
                Word lookup and sync features resume when you&apos;re back online.
              </p>
            </div>
          </div>
        </div>

        <header className="glass-panel rounded-[2rem] p-5 sm:p-6">
          <p className="editorial-label mb-2">Saved Article</p>
          <h1
            className="max-w-3xl font-semibold leading-tight tracking-[-0.03em]"
            style={{ fontSize: fontSize + 8 }}
          >
            {article.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="glass-chip rounded-full px-3 py-1.5 font-medium text-primary">
              {article.source_name}
            </span>
            {article.author && (
              <span className="glass-chip rounded-full px-3 py-1.5">{article.author}</span>
            )}
            {formattedDate && (
              <span className="glass-chip rounded-full px-3 py-1.5">{formattedDate}</span>
            )}
          </div>

          {!article.url.startsWith("wordreader://") && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-chip mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted transition hover:text-primary"
            >
              View original <ExternalLink size={12} />
            </a>
          )}
        </header>

        {article.image_url && (
          <div className="glass-panel overflow-hidden rounded-[1.8rem] p-2">
            <Image
              src={article.image_url}
              alt={article.title}
              width={1200}
              height={675}
              sizes="(max-width: 640px) 100vw, 768px"
              className="h-auto max-h-96 w-full rounded-[1.35rem] object-cover"
              unoptimized
            />
          </div>
        )}

        <div className="reader-paper rounded-[2rem] px-5 py-6 sm:px-8 sm:py-8">
          <div
            className="article-content max-w-none"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineSpacing,
            }}
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </div>
      </article>
    </div>
  );
}
