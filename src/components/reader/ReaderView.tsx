"use client";

import { useState, useEffect, useRef } from "react";
import ReaderControls from "./ReaderControls";
import VocabPopup from "./VocabPopup";
import { useTextSelection } from "@/hooks/useTextSelection";
import type { Article } from "@/types";
import { ExternalLink } from "lucide-react";

interface ReaderViewProps {
  article: Article;
}

export default function ReaderView({ article }: ReaderViewProps) {
  const [fontSize, setFontSize] = useState(18);
  const [lineSpacing, setLineSpacing] = useState(1.6);

  // Load persisted reading preferences
  useEffect(() => {
    const savedFontSize = localStorage.getItem("readerFontSize");
    const savedLineSpacing = localStorage.getItem("readerLineSpacing");
    if (savedFontSize) setFontSize(parseInt(savedFontSize));
    if (savedLineSpacing) setLineSpacing(parseFloat(savedLineSpacing));
  }, []);
  const contentRef = useRef<HTMLDivElement>(null);
  const { selection, clearSelection } = useTextSelection(contentRef);
  const [popupData, setPopupData] = useState<{
    word: string;
    sentence: string;
  } | null>(null);

  // Format the publication date
  const formattedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // When user selects text and we detect it, show the popup
  const handleOpenPopup = () => {
    if (selection) {
      setPopupData({ word: selection.text, sentence: selection.sentence });
      clearSelection();
    }
  };

  const handleClosePopup = () => {
    setPopupData(null);
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <ReaderControls
        fontSize={fontSize}
        lineSpacing={lineSpacing}
        onFontSizeChange={setFontSize}
        onLineSpacingChange={setLineSpacing}
      />

      <article className="flex-1 px-5 py-6 max-w-2xl mx-auto w-full">
        {/* Article header */}
        <header className="mb-6">
          <h1
            className="font-bold leading-tight mb-3"
            style={{ fontSize: fontSize + 6 }}
          >
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="font-medium text-primary">
              {article.source_name}
            </span>
            {article.author && <span>{article.author}</span>}
            {formattedDate && <span>{formattedDate}</span>}
          </div>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary mt-2 transition"
          >
            View original <ExternalLink size={12} />
          </a>
        </header>

        {/* Hero image */}
        {article.image_url && (
          <div className="mb-6 -mx-5 sm:mx-0 sm:rounded-xl overflow-hidden">
            <img
              src={article.image_url}
              alt=""
              className="w-full h-auto object-cover max-h-80"
              loading="lazy"
            />
          </div>
        )}

        {/* Article body — rendered as HTML from the extractor */}
        <div
          ref={contentRef}
          className="article-content prose dark:prose-invert max-w-none"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: lineSpacing,
          }}
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </article>

      {/* Selection action bar — appears when text is selected */}
      {selection && !popupData && (
        <div className="fixed bottom-0 left-0 right-0 z-40 pb-safe">
          <div className="mx-4 mb-4 max-w-lg mx-auto">
            <button
              onClick={handleOpenPopup}
              className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/25 flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              Look up &ldquo;{selection.text.length > 30 ? selection.text.slice(0, 30) + "..." : selection.text}&rdquo;
            </button>
          </div>
        </div>
      )}

      {/* Vocabulary popup / bottom sheet */}
      {popupData && (
        <VocabPopup
          word={popupData.word}
          sentence={popupData.sentence}
          articleId={article.id}
          articleTitle={article.title}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
}
