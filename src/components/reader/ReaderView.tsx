"use client";

import Image from "next/image";
import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { BookMarked, ExternalLink, RotateCcw } from "lucide-react";
import ProfileBootstrap from "@/components/layout/ProfileBootstrap";
import ArticleNotes from "./ArticleNotes";
import ArticleQuiz from "./ArticleQuiz";
import ReaderControls from "./ReaderControls";
import SavedWordPopup from "./SavedWordPopup";
import SelectionActionBar from "./SelectionActionBar";
import VocabPopup from "./VocabPopup";
import { useTextSelection } from "@/hooks/useTextSelection";
import {
  getSelectionMaxLength,
  getStoredLookupStyle,
  inferLookupMode,
  normalizeLookupText,
  persistLookupStyle,
  type LookupRequest,
} from "@/lib/lookup";
import { createClient } from "@/lib/supabase/client";
import { getOfflineVocabulary, saveOfflineArticle } from "@/lib/offline";
import { getUserWithProfile } from "@/lib/supabase/ensureProfile";
import type {
  Article,
  LookupIntent,
  LookupResult,
  ReaderLookupStyle,
  SavedVocabularyPreview,
} from "@/types";

interface ReaderViewProps {
  article: Article;
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toSavedWordKey(value: string) {
  return normalizeLookupText(value).toLowerCase();
}

function createSavedVocabularyMap(items: SavedVocabularyPreview[]) {
  return new Map(items.map((item) => [toSavedWordKey(item.word), item]));
}

function highlightArticleContent(
  content: string,
  savedItems: SavedVocabularyPreview[],
  activeWordKey?: string | null
) {
  if (typeof window === "undefined" || savedItems.length === 0) {
    return content;
  }

  const normalizedWords = [...new Set(savedItems.map((item) => item.word))]
    .map((word) => normalizeLookupText(word))
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
      const wordKey = toSavedWordKey(match);
      mark.className = wordKey === activeWordKey ? "reader-saved-word is-active" : "reader-saved-word";
      mark.dataset.word = wordKey;
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
  const [lookupMode, setLookupMode] = useState<ReaderLookupStyle>(getStoredLookupStyle);
  const [savedVocabulary, setSavedVocabulary] = useState<SavedVocabularyPreview[]>([]);
  const [renderedContent, setRenderedContent] = useState(article.content);
  const [resumePosition, setResumePosition] = useState<number | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [lookupRequest, setLookupRequest] = useState<LookupRequest | null>(null);
  const [savedWordPreview, setSavedWordPreview] = useState<SavedVocabularyPreview | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const userIdRef = useRef<string | null>(null);
  const latestSelectionRef = useRef<string | null>(null);
  const progressRef = useRef(0);
  const lookupCacheRef = useRef<Map<string, LookupResult>>(new Map());
  const savedVocabularyMapRef = useRef<Map<string, SavedVocabularyPreview>>(new Map());
  const deferredSavedVocabulary = useDeferredValue(savedVocabulary);

  const { selection, clearSelection, selectionNotice } = useTextSelection(contentRef, {
    maxLength: getSelectionMaxLength(lookupMode),
  });

  const applySavedVocabulary = (items: SavedVocabularyPreview[]) => {
    const deduped = items.filter(
      (item, index, current) =>
        current.findIndex((candidate) => candidate.id === item.id) === index
    );

    savedVocabularyMapRef.current = createSavedVocabularyMap(deduped);
    setSavedVocabulary(deduped);
  };

  useEffect(() => {
    if (selection?.text) {
      latestSelectionRef.current = selection.text;
    }
  }, [selection]);

  useEffect(() => {
    if (!lookupRequest) return;
    latestSelectionRef.current = lookupRequest.text;
  }, [lookupRequest]);

  useEffect(() => {
    const updateReadingProgress = () => {
      const container = viewportRef.current;
      if (!container) return;

      const scrollableHeight = container.scrollHeight - container.clientHeight;
      if (scrollableHeight <= 0) {
        setReadingProgress(0);
        return;
      }

      setReadingProgress(Math.min(100, Math.max(0, Math.round((container.scrollTop / scrollableHeight) * 100))));
    };

    const loadReaderContext = async () => {
      if (!supabase) return;

      let shouldCacheOffline = true;
      const { user, error: userError } = await getUserWithProfile(supabase);

      if (!user) {
        const offlineVocabulary = getOfflineVocabulary();
        if (offlineVocabulary.items.length > 0) {
          applySavedVocabulary(offlineVocabulary.items);
        }
        if (userError && userError !== "Please sign in again.") {
          setSyncNotice(
            "Cloud sync is unavailable right now. Reading still works, but notes and vocabulary saves may fail."
          );
        }
        if (shouldCacheOffline) {
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
        return;
      }

      setSyncNotice(null);
      userIdRef.current = user.id;

      const [{ data: settings }, { data: vocabItems }, { data: history }] =
        await Promise.all([
          supabase
            .from("user_settings")
            .select("font_size, line_spacing, reader_mode, enable_offline")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("vocabulary_items")
            .select(
              "id, word, thai_meaning, english_meaning, part_of_speech, difficulty, pronunciation, last_source_name"
            )
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
        persistLookupStyle(settings.reader_mode);
      }

      if (settings?.enable_offline === false) {
        shouldCacheOffline = false;
      }

      if (vocabItems) {
        applySavedVocabulary(vocabItems as SavedVocabularyPreview[]);
      } else {
        const offlineVocabulary = getOfflineVocabulary();
        if (offlineVocabulary.items.length > 0) {
          applySavedVocabulary(offlineVocabulary.items);
        }
      }

        if (history?.last_position && history.last_position > 120) {
          setResumePosition(history.last_position);
        }

      if (shouldCacheOffline) {
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
    updateReadingProgress();
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
    const viewport = viewportRef.current;
    if (!supabase || !viewport) return;

    const saveProgress = async () => {
      const userId = userIdRef.current;
      const container = viewportRef.current;
      if (!userId || !container) return;

      const isFinished =
        container.scrollTop + container.clientHeight >= container.scrollHeight - 120;

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
      const container = viewportRef.current;
      if (!container) return;

      progressRef.current = container.scrollTop;
      const scrollableHeight = container.scrollHeight - container.clientHeight;
      setReadingProgress(
        scrollableHeight <= 0
          ? 0
          : Math.min(100, Math.max(0, Math.round((container.scrollTop / scrollableHeight) * 100)))
      );
      clearSelection();
    };

    const interval = window.setInterval(() => {
      void saveProgress();
    }, 8000);

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("beforeunload", saveProgress);

    return () => {
      window.clearInterval(interval);
      viewport.removeEventListener("scroll", handleScroll);
      window.removeEventListener("beforeunload", saveProgress);
      void saveProgress();
    };
  }, [article.id, clearSelection, supabase]);

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
        deferredSavedVocabulary.length === 0
          ? article.content
          : highlightArticleContent(
              article.content,
              deferredSavedVocabulary,
              savedWordPreview ? toSavedWordKey(savedWordPreview.word) : null
            );

      startTransition(() => {
        setRenderedContent(nextContent);
      });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [article.content, deferredSavedVocabulary, savedWordPreview]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const mark = target.closest("mark[data-word]") as HTMLElement | null;
      if (!mark) return;

      if (window.getSelection()?.toString().trim()) {
        return;
      }

      const wordKey = mark.dataset.word;
      if (!wordKey) return;

      const item = savedVocabularyMapRef.current.get(wordKey);
      if (!item) return;

      setSavedWordPreview(item);
      setLookupRequest(null);
      clearSelection();
    };

    container.addEventListener("click", handleClick);
    return () => {
      container.removeEventListener("click", handleClick);
    };
  }, [clearSelection]);

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
    void persistSetting({ font_size: size });
  };

  const handleLineSpacingChange = (spacing: number) => {
    setLineSpacing(spacing);
    localStorage.setItem("readerLineSpacing", spacing.toString());
    void persistSetting({ line_spacing: spacing });
  };

  const handleLookupModeChange = (mode: ReaderLookupStyle) => {
    setLookupMode(mode);
    persistLookupStyle(mode);
    void persistSetting({ reader_mode: mode });
  };

  const handleResume = () => {
    const viewport = viewportRef.current;
    if (!viewport || resumePosition === null) return;
    viewport.scrollTo({ top: resumePosition, behavior: "smooth" });
  };

  const handleJumpToNotes = () => {
    notesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const plainArticleText = article.content.replace(/<[^>]+>/g, " ");

  const handleWordSaved = (item: SavedVocabularyPreview) => {
    const existing = savedVocabularyMapRef.current.get(toSavedWordKey(item.word));
    const nextItems = existing
      ? savedVocabulary.map((current) =>
          current.id === item.id || toSavedWordKey(current.word) === toSavedWordKey(item.word)
            ? item
            : current
        )
      : [...savedVocabulary, item];

    applySavedVocabulary(nextItems);
  };

  const handleLookupAction = (intent: LookupIntent) => {
    if (!selection) return;

    const mode = inferLookupMode(selection, lookupMode);
    setSavedWordPreview(null);
    setLookupRequest({
      text: selection.text,
      sentence: selection.sentence,
      paragraph: selection.paragraph,
      mode,
      intent,
    });
    clearSelection();
  };

  const activeSelectionMode = selection ? inferLookupMode(selection, lookupMode) : null;

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <ProfileBootstrap />
      <ReaderControls
        fontSize={fontSize}
        lineSpacing={lineSpacing}
        lookupMode={lookupMode}
        articleTitle={article.title}
        articleSourceName={article.source_name}
        articleText={plainArticleText}
        articleUrl={article.url}
        readingProgress={readingProgress}
        onFontSizeChange={handleFontSizeChange}
        onLineSpacingChange={handleLineSpacingChange}
        onLookupModeChange={handleLookupModeChange}
        onJumpToNotes={handleJumpToNotes}
      />

      <div
        ref={viewportRef}
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ scrollPaddingTop: "var(--reader-toolbar-offset)" }}
      >
        <article className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 py-6 pb-24">
          <header className="glass-panel mb-6 rounded-[2rem] p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {savedVocabulary.length > 0 && (
                <span className="glass-chip inline-flex max-w-full items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-primary">
                  <BookMarked size={12} />
                  <span className="chip-truncate">
                    {savedVocabulary.length} saved words highlighted
                  </span>
                </span>
              )}
              {resumePosition !== null && (
                <button
                  type="button"
                  onClick={handleResume}
                  className="glass-chip inline-flex max-w-full items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-muted hover:text-foreground"
                >
                  <RotateCcw size={12} />
                  <span className="chip-truncate">Resume where you left off</span>
                </button>
              )}
            </div>

            {syncNotice && (
              <div className="text-safe-body mb-4 rounded-[1.2rem] bg-warning/10 px-3 py-2 text-sm text-warning">
                {syncNotice}
              </div>
            )}

            <p className="editorial-label mb-2">Reader View</p>
            <h1
              className="text-safe-title mb-3 font-bold tracking-tight"
              style={{ fontSize: fontSize + 6 }}
            >
              {article.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
              <span className="glass-chip max-w-full rounded-full px-3 py-1 text-xs font-medium text-primary">
                <span className="chip-truncate">{article.source_name}</span>
              </span>
              {article.author && <span className="text-safe-meta">{article.author}</span>}
              {formattedDate && <span className="text-safe-meta">{formattedDate}</span>}
            </div>

            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex max-w-full items-center gap-1 text-xs text-muted transition hover:text-primary"
            >
              <span className="chip-truncate">View original</span> <ExternalLink size={12} />
            </a>
          </header>

          {article.image_url && (
            <div className="glass-panel mb-6 overflow-hidden rounded-[1.6rem] p-2">
              <Image
                src={article.image_url}
                alt={article.title}
                width={1200}
                height={675}
                sizes="(max-width: 640px) 100vw, 768px"
                className="max-h-80 w-full rounded-[1.2rem] object-cover"
                unoptimized
              />
            </div>
          )}

          <div className="reader-paper rounded-[2rem] px-5 py-6 sm:px-8">
            <div
              ref={contentRef}
              className="article-content prose max-w-none dark:prose-invert"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: lineSpacing,
              }}
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          </div>

          <div ref={notesRef}>
            <ArticleNotes articleId={article.id} />
          </div>
          <ArticleQuiz
            articleId={article.id}
            articleTitle={article.title}
            content={plainArticleText}
          />
        </article>
      </div>

      {!selection && selectionNotice && !lookupRequest && !savedWordPreview && (
        <div className="fixed bottom-0 left-0 right-0 z-30 pb-safe">
          <div className="mx-auto max-w-lg px-4 pb-4">
            <div className="glass-panel text-safe-body rounded-xl px-4 py-3 text-sm text-warning">
              {selectionNotice}
            </div>
          </div>
        </div>
      )}

      {selection && activeSelectionMode && !lookupRequest && !savedWordPreview && (
        <SelectionActionBar
          text={selection.text}
          mode={activeSelectionMode}
          onTranslate={() => handleLookupAction("translate")}
          onExplain={
            activeSelectionMode === "vocab"
              ? undefined
              : () => handleLookupAction("explain")
          }
          onDismiss={clearSelection}
        />
      )}

      {savedWordPreview && !lookupRequest && (
        <SavedWordPopup
          item={savedWordPreview}
          onClose={() => setSavedWordPreview(null)}
        />
      )}

      {lookupRequest && (
        <VocabPopup
          lookup={lookupRequest}
          articleId={article.id}
          articleTitle={article.title}
          articleSourceName={article.source_name}
          cacheRef={lookupCacheRef}
          onSaved={handleWordSaved}
          onClose={() => setLookupRequest(null)}
        />
      )}
    </div>
  );
}
