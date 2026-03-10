"use client";

import Image from "next/image";
import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { ExternalLink, BookMarked, RotateCcw } from "lucide-react";
import ReaderControls from "./ReaderControls";
import VocabPopup from "./VocabPopup";
import ArticleNotes from "./ArticleNotes";
import ArticleQuiz from "./ArticleQuiz";
import { useTextSelection } from "@/hooks/useTextSelection";
import { createClient } from "@/lib/supabase/client";
import { getOfflineVocabulary, saveOfflineArticle } from "@/lib/offline";
import type { Article } from "@/types";

interface ReaderViewProps {
  article: Article;
}

interface SavedWordRow {
  word: string;
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightArticleContent(content: string, savedWords: string[]) {
  if (typeof window === "undefined" || savedWords.length === 0) {
    return content;
  }

  const normalizedWords = [...new Set(savedWords)]
    .map((word) => word.trim())
    .filter((word) => word.length >= 3)
    .sort((a, b) => b.length - a.length)
    .slice(0, 80);

  if (normalizedWords.length === 0) {
    return content;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="reader-root">${content}</div>`, "text/html");
  const root = doc.getElementById("reader-root");
  if (!root) return content;

  const regex = new RegExp(`(${normalizedWords.map(escapeRegex).join("|")})`, "gi");
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parentTag = node.parentElement?.tagName.toLowerCase();
    if (!parentTag || ["script", "style", "mark", "a"].includes(parentTag)) continue;
    if (regex.test(node.textContent || "")) {
      nodes.push(node);
    }
    regex.lastIndex = 0;
  }

  for (const node of nodes) {
    const text = node.textContent || "";
    const fragment = doc.createDocumentFragment();
    let lastIndex = 0;

    text.replace(regex, (match, _capture, offset) => {
      if (offset > lastIndex) {
        fragment.append(doc.createTextNode(text.slice(lastIndex, offset)));
      }

      const mark = doc.createElement("mark");
      mark.className = "rounded bg-primary/15 px-1 text-primary";
      mark.textContent = match;
      fragment.append(mark);
      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < text.length) {
      fragment.append(doc.createTextNode(text.slice(lastIndex)));
    }

    node.parentNode?.replaceChild(fragment, node);
  }

  return root.innerHTML;
}

export default function ReaderView({ article }: ReaderViewProps) {
  const supabase = createClient();
  const [fontSize, setFontSize] = useState(getStoredFontSize);
  const [lineSpacing, setLineSpacing] = useState(getStoredLineSpacing);
  const [lookupMode, setLookupMode] = useState<"word" | "phrase">(getStoredLookupMode);
  const [savedWords, setSavedWords] = useState<string[]>([]);
  const [renderedContent, setRenderedContent] = useState(article.content);
  const [resumePosition, setResumePosition] = useState<number | null>(null);
  const [popupData, setPopupData] = useState<{
    word: string;
    sentence: string;
  } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const userIdRef = useRef<string | null>(null);
  const latestSelectionRef = useRef<string | null>(null);
  const progressRef = useRef(0);
  const deferredSavedWords = useDeferredValue(savedWords);

  const { selection, clearSelection } = useTextSelection(contentRef, {
    maxLength: lookupMode === "phrase" ? 240 : 48,
  });

  useEffect(() => {
    latestSelectionRef.current = selection?.text || null;
  }, [selection]);

  useEffect(() => {
    const loadReaderContext = async () => {
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const offlineVocabulary = getOfflineVocabulary();
        if (offlineVocabulary.items.length > 0) {
          setSavedWords(offlineVocabulary.items.map((entry) => entry.word));
        }
        return;
      }
      userIdRef.current = user.id;

      const [{ data: settings }, { data: vocabWords }, { data: history }] =
        await Promise.all([
          supabase
            .from("user_settings")
            .select("font_size, line_spacing, reader_mode, enable_offline")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("vocabulary_items")
            .select("word")
            .eq("user_id", user.id),
          supabase
            .from("reading_history")
            .select("last_position")
            .eq("user_id", user.id)
            .eq("article_id", article.id)
            .maybeSingle(),
        ]);

      if (settings?.font_size) {
        setFontSize(settings.font_size);
        localStorage.setItem("readerFontSize", settings.font_size.toString());
      }
      if (settings?.line_spacing) {
        setLineSpacing(settings.line_spacing);
        localStorage.setItem("readerLineSpacing", settings.line_spacing.toString());
      }
      if (settings?.reader_mode === "word" || settings?.reader_mode === "phrase") {
        setLookupMode(settings.reader_mode);
        localStorage.setItem("readerLookupMode", settings.reader_mode);
      }

      if (vocabWords) {
        setSavedWords((vocabWords as SavedWordRow[]).map((entry) => entry.word));
      } else {
        const offlineVocabulary = getOfflineVocabulary();
        if (offlineVocabulary.items.length > 0) {
          setSavedWords(offlineVocabulary.items.map((entry) => entry.word));
        }
      }

      if (history?.last_position && history.last_position > 120) {
        setResumePosition(history.last_position);
      }

      if (settings?.enable_offline !== false) {
        saveOfflineArticle({
          id: article.id,
          title: article.title,
          url: article.url,
          source_name: article.source_name,
          author: article.author,
          published_at: article.published_at,
          image_url: article.image_url,
          content: article.content,
        });
      }

      await supabase.from("reading_history").upsert(
        {
          user_id: user.id,
          article_id: article.id,
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,article_id" }
      );
    };

    void loadReaderContext();
  }, [
    article.author,
    article.content,
    article.id,
    article.image_url,
    article.published_at,
    article.source_name,
    article.title,
    article.url,
    supabase,
  ]);

  useEffect(() => {
    if (!supabase) return;

    const saveProgress = async () => {
      const userId = userIdRef.current;
      if (!userId) return;

      const isFinished =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 120;

      await supabase.from("reading_history").upsert(
        {
          user_id: userId,
          article_id: article.id,
          updated_at: new Date().toISOString(),
          last_position: Math.round(progressRef.current),
          last_selected_text: latestSelectionRef.current,
          is_finished: isFinished,
        },
        { onConflict: "user_id,article_id" }
      );
    };

    const handleScroll = () => {
      progressRef.current = window.scrollY;
    };

    const interval = window.setInterval(() => {
      void saveProgress();
    }, 8000);

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("beforeunload", saveProgress);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("beforeunload", saveProgress);
      void saveProgress();
    };
  }, [article.id, supabase]);

  const persistSetting = async (values: Record<string, unknown>) => {
    const userId = userIdRef.current;
    if (!supabase || !userId) return;

    await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        ...values,
      },
      { onConflict: "user_id" }
    );
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextContent =
        deferredSavedWords.length === 0
          ? article.content
          : highlightArticleContent(article.content, deferredSavedWords);

      startTransition(() => {
        setRenderedContent(nextContent);
      });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [article.content, deferredSavedWords]);

  const formattedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const handleOpenPopup = () => {
    if (selection) {
      setPopupData({ word: selection.text, sentence: selection.sentence });
      clearSelection();
    }
  };

  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
    localStorage.setItem("readerFontSize", size.toString());
    void persistSetting({ font_size: size });
  };

  const handleLineSpacingChange = (spacing: number) => {
    setLineSpacing(spacing);
    localStorage.setItem("readerLineSpacing", spacing.toString());
    void persistSetting({ line_spacing: spacing });
  };

  const handleLookupModeChange = (mode: "word" | "phrase") => {
    setLookupMode(mode);
    localStorage.setItem("readerLookupMode", mode);
    void persistSetting({ reader_mode: mode });
  };

  const handleResume = () => {
    if (resumePosition === null) return;
    window.scrollTo({ top: resumePosition, behavior: "smooth" });
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

      <article className="flex-1 px-5 py-6 max-w-2xl mx-auto w-full">
        <header className="mb-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {savedWords.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <BookMarked size={12} />
                {savedWords.length} saved words highlighted
              </span>
            )}
            {resumePosition !== null && (
              <button
                type="button"
                onClick={handleResume}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted hover:text-foreground"
              >
                <RotateCcw size={12} />
                Resume where you left off
              </button>
            )}
          </div>

          <h1
            className="font-bold leading-tight mb-3"
            style={{ fontSize: fontSize + 6 }}
          >
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="font-medium text-primary">{article.source_name}</span>
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

        {article.image_url && (
          <div className="mb-6 -mx-5 sm:mx-0 sm:rounded-xl overflow-hidden">
            <Image
              src={article.image_url}
              alt={article.title}
              width={1200}
              height={675}
              sizes="(max-width: 640px) 100vw, 768px"
              className="w-full h-auto object-cover max-h-80"
              unoptimized
            />
          </div>
        )}

        <div
          ref={contentRef}
          className="article-content prose dark:prose-invert max-w-none"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: lineSpacing,
          }}
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />

        <ArticleNotes articleId={article.id} />
        <ArticleQuiz
          articleId={article.id}
          articleTitle={article.title}
          content={article.content.replace(/<[^>]+>/g, " ")}
        />
      </article>

      {selection && !popupData && (
        <div className="fixed bottom-0 left-0 right-0 z-40 pb-safe">
          <div className="mx-4 mb-4 max-w-lg mx-auto">
            <button
              onClick={handleOpenPopup}
              className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/25 flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              {lookupMode === "word" ? "Look up" : "Explore"} &ldquo;
              {selection.text.length > 30 ? `${selection.text.slice(0, 30)}...` : selection.text}
              &rdquo;
            </button>
          </div>
        </div>
      )}

      {popupData && (
        <VocabPopup
          word={popupData.word}
          sentence={popupData.sentence}
          articleId={article.id}
          articleTitle={article.title}
          articleSourceName={article.source_name}
          onClose={() => setPopupData(null)}
        />
      )}
    </div>
  );
}
