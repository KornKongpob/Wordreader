"use client";

import createDOMPurify from "dompurify";
import Image from "next/image";
import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { BookMarked, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import ProfileBootstrap from "@/components/layout/ProfileBootstrap";
import ArticleNotes from "./ArticleNotes";
import ArticleQuiz from "./ArticleQuiz";
import ReaderControls from "./ReaderControls";
import SavedWordPopup from "./SavedWordPopup";
import SelectionActionBar from "./SelectionActionBar";
import SentencePopup from "./SentencePopup";
import VocabPopup from "./VocabPopup";
import { useTextSelection } from "@/hooks/useTextSelection";
import {
  getSelectionMaxLength,
  getStoredLookupStyle,
  inferLookupMode,
  normalizeLookupText,
  persistLookupStyle,
  SMART_SELECTION_MAX_LENGTH,
  type LookupRequest,
} from "@/lib/lookup";
import { getOfflineVocabulary, saveOfflineArticle } from "@/lib/offline";
import { createClient } from "@/lib/supabase/client";
import { getUserWithProfile } from "@/lib/supabase/ensureProfile";
import type {
  Article,
  DetectedIdiom,
  LookupIntent,
  LookupResult,
  ReaderLookupStyle,
  SavedVocabularyPreview,
  SentenceAnalysisResult,
} from "@/types";

interface ReaderViewProps {
  article: Article;
}

interface SentenceLookupRequest {
  text: string;
  sentence: string;
  paragraph: string;
}

interface IdiomTooltipState extends DetectedIdiom {
  x: number;
  y: number;
  placement: "top" | "bottom";
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

function toIdiomKey(value: string) {
  return normalizeLookupText(value).toLowerCase();
}

function createSavedVocabularyMap(items: SavedVocabularyPreview[]) {
  return new Map(items.map((item) => [toSavedWordKey(item.word), item]));
}

function sanitizeReaderHtml(content: string) {
  if (typeof window === "undefined") {
    return content;
  }

  const DOMPurify = createDOMPurify(window);
  return DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true },
    ADD_ATTR: [
      "data-meaning",
      "data-phrase",
      "data-type",
      "data-word",
      "data-reader-collocation",
      "data-reader-separator",
    ],
  });
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
    const parentElement = node.parentElement;
    const parentTag = parentElement?.tagName.toLowerCase();

    if (!parentTag || ["script", "style", "mark", "a"].includes(parentTag)) {
      continue;
    }

    if (parentElement?.closest(".idiom-highlight")) {
      continue;
    }

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

function highlightIdiomPhrases(content: string, idioms: DetectedIdiom[]) {
  if (typeof window === "undefined" || idioms.length === 0) {
    return content;
  }

  const uniqueIdioms = idioms
    .filter(
      (item, index, items) =>
        items.findIndex((candidate) => toIdiomKey(candidate.phrase) === toIdiomKey(item.phrase)) === index
    )
    .sort((a, b) => b.phrase.length - a.phrase.length);

  if (uniqueIdioms.length === 0) {
    return content;
  }

  const idiomMap = new Map(uniqueIdioms.map((item) => [toIdiomKey(item.phrase), item]));
  const regex = new RegExp(
    `(${uniqueIdioms
      .map((item) => escapeRegex(normalizeLookupText(item.phrase)).replace(/\\ /g, "\\s+"))
      .join("|")})`,
    "gi"
  );

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="reader-root">${content}</div>`, "text/html");
  const root = doc.getElementById("reader-root");
  if (!root) return content;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parentElement = node.parentElement;
    const parentTag = parentElement?.tagName.toLowerCase();

    if (!parentTag || ["script", "style", "mark", "a"].includes(parentTag)) {
      continue;
    }

    if (parentElement?.closest(".idiom-highlight")) {
      continue;
    }

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

      const idiom = idiomMap.get(toIdiomKey(match));
      if (idiom) {
        const span = doc.createElement("span");
        span.className =
          "idiom-highlight border-b-2 border-dashed border-orange-400 cursor-pointer rounded-sm";
        span.dataset.meaning = idiom.meaning;
        span.dataset.type = idiom.type;
        span.dataset.phrase = idiom.phrase;
        span.textContent = match;
        fragment.append(span);
      } else {
        fragment.append(doc.createTextNode(match));
      }

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
  const [sentenceLookup, setSentenceLookup] = useState<SentenceLookupRequest | null>(null);
  const [savedWordPreview, setSavedWordPreview] = useState<SavedVocabularyPreview | null>(null);
  const [readingHelperEnabled, setReadingHelperEnabled] = useState(false);
  const [chunkedContent, setChunkedContent] = useState<string | null>(null);
  const [chunkingLoading, setChunkingLoading] = useState(false);
  const [chunkingError, setChunkingError] = useState<string | null>(null);
  const [detectedIdioms, setDetectedIdioms] = useState<DetectedIdiom[]>([]);
  const [idiomDetectionLoading, setIdiomDetectionLoading] = useState(false);
  const [idiomError, setIdiomError] = useState<string | null>(null);
  const [idiomScanCompleted, setIdiomScanCompleted] = useState(false);
  const [idiomTooltip, setIdiomTooltip] = useState<IdiomTooltipState | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const userIdRef = useRef<string | null>(null);
  const latestSelectionRef = useRef<string | null>(null);
  const progressRef = useRef(0);
  const lookupCacheRef = useRef<Map<string, LookupResult>>(new Map());
  const savedVocabularyMapRef = useRef<Map<string, SavedVocabularyPreview>>(new Map());
  const sentenceAnalysisCacheRef = useRef<Map<string, SentenceAnalysisResult>>(new Map());
  const chunkedContentCacheRef = useRef<Map<string, string>>(new Map());
  const idiomCacheRef = useRef<Map<string, DetectedIdiom[]>>(new Map());
  const idiomRequestRef = useRef<AbortController | null>(null);
  const deferredSavedVocabulary = useDeferredValue(savedVocabulary);

  const selectionMaxLength =
    lookupMode === "word" ? Math.max(getSelectionMaxLength(lookupMode), 240) : SMART_SELECTION_MAX_LENGTH;

  const { selection, clearSelection, selectionNotice } = useTextSelection(contentRef, {
    maxLength: selectionMaxLength,
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
      setIdiomTooltip(null);
    }
  }, [selection]);

  useEffect(() => {
    if (!lookupRequest) return;
    latestSelectionRef.current = lookupRequest.text;
  }, [lookupRequest]);

  useEffect(() => {
    if (!sentenceLookup) return;
    latestSelectionRef.current = sentenceLookup.sentence;
  }, [sentenceLookup]);

  useEffect(() => {
    const cachedChunkedContent = chunkedContentCacheRef.current.get(article.id) ?? null;
    const cachedIdioms = idiomCacheRef.current.get(article.id);

    setChunkedContent(cachedChunkedContent);
    setChunkingLoading(false);
    setChunkingError(null);
    setDetectedIdioms(cachedIdioms ?? []);
    setIdiomScanCompleted(cachedIdioms !== undefined);
    setIdiomDetectionLoading(false);
    setIdiomError(null);
    setIdiomTooltip(null);
    setLookupRequest(null);
    setSentenceLookup(null);
    setSavedWordPreview(null);
  }, [article.id]);

  useEffect(() => {
    const updateReadingProgress = () => {
      const container = viewportRef.current;
      if (!container) return;

      const scrollableHeight = container.scrollHeight - container.clientHeight;
      if (scrollableHeight <= 0) {
        setReadingProgress(0);
        return;
      }

      setReadingProgress(
        Math.min(100, Math.max(0, Math.round((container.scrollTop / scrollableHeight) * 100)))
      );
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

      const [{ data: settings }, { data: vocabItems }, { data: history }] = await Promise.all([
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
      setIdiomTooltip(null);
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

  useEffect(() => {
    if (!readingHelperEnabled) {
      return;
    }

    const cachedChunkedContent = chunkedContentCacheRef.current.get(article.id);
    if (cachedChunkedContent) {
      setChunkedContent(cachedChunkedContent);
      setChunkingError(null);
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const fetchChunkedContent = async () => {
      setChunkingLoading(true);
      setChunkingError(null);

      try {
        const response = await fetch("/api/chunk-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            content: article.content,
            articleTitle: article.title,
          }),
        });

        const data = (await response.json()) as { html?: string; error?: string };
        if (!response.ok || !data.html) {
          if (!isCancelled) {
            setChunkingError(data.error || "Could not prepare chunked reading help.");
          }
          return;
        }

        if (isCancelled) return;

        chunkedContentCacheRef.current.set(article.id, data.html);
        setChunkedContent(data.html);
      } catch (error) {
        if (controller.signal.aborted || isCancelled) {
          return;
        }

        console.error("Chunk text request failed:", error);
        setChunkingError("Could not prepare chunked reading help right now.");
      } finally {
        if (!isCancelled) {
          setChunkingLoading(false);
        }
      }
    };

    void fetchChunkedContent();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [article.content, article.id, article.title, readingHelperEnabled]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const sourceContent = readingHelperEnabled && chunkedContent ? chunkedContent : article.content;
      const sanitizedContent = sanitizeReaderHtml(sourceContent);
      const idiomEnhancedContent =
        idiomScanCompleted && detectedIdioms.length > 0
          ? highlightIdiomPhrases(sanitizedContent, detectedIdioms)
          : sanitizedContent;
      const nextContent =
        deferredSavedVocabulary.length === 0
          ? idiomEnhancedContent
          : highlightArticleContent(
              idiomEnhancedContent,
              deferredSavedVocabulary,
              savedWordPreview ? toSavedWordKey(savedWordPreview.word) : null
            );

      startTransition(() => {
        setRenderedContent(nextContent);
      });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [
    article.content,
    chunkedContent,
    deferredSavedVocabulary,
    detectedIdioms,
    idiomScanCompleted,
    readingHelperEnabled,
    savedWordPreview,
  ]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const idiomHighlight = target.closest(".idiom-highlight") as HTMLElement | null;
      if (idiomHighlight) {
        if (window.getSelection()?.toString().trim()) {
          return;
        }

        const phrase = idiomHighlight.dataset.phrase || idiomHighlight.textContent || "";
        const meaning = idiomHighlight.dataset.meaning || "";
        const type = idiomHighlight.dataset.type === "phrasal_verb" ? "phrasal_verb" : "idiom";
        const rect = idiomHighlight.getBoundingClientRect();
        const placement = rect.top > 160 ? "top" : "bottom";
        const x = Math.min(window.innerWidth - 24, Math.max(24, rect.left + rect.width / 2));
        const y = placement === "top" ? rect.top - 14 : rect.bottom + 14;

        setIdiomTooltip({ phrase, meaning, type, x, y, placement });
        setSavedWordPreview(null);
        setLookupRequest(null);
        setSentenceLookup(null);
        clearSelection();
        return;
      }

      setIdiomTooltip(null);

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
      setSentenceLookup(null);
      clearSelection();
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (container.contains(target) || tooltipRef.current?.contains(target)) {
        return;
      }

      setIdiomTooltip(null);
    };

    container.addEventListener("click", handleClick);
    document.addEventListener("click", handleDocumentClick);

    return () => {
      container.removeEventListener("click", handleClick);
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [clearSelection]);

  useEffect(() => {
    return () => {
      idiomRequestRef.current?.abort();
    };
  }, []);

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

    if (selection.kind === "sentence") {
      setSavedWordPreview(null);
      setLookupRequest(null);
      setSentenceLookup({
        text: selection.text,
        sentence: selection.sentence,
        paragraph: selection.paragraph,
      });
      clearSelection();
      return;
    }

    const mode = inferLookupMode(selection, lookupMode);
    setIdiomTooltip(null);
    setSavedWordPreview(null);
    setSentenceLookup(null);
    setLookupRequest({
      text: selection.text,
      sentence: selection.sentence,
      paragraph: selection.paragraph,
      mode,
      intent,
    });
    clearSelection();
  };

  const handleReadingHelperToggle = (enabled: boolean) => {
    setReadingHelperEnabled(enabled);
    setChunkingError(null);
  };

  const handleDetectIdioms = async () => {
    const cachedIdioms = idiomCacheRef.current.get(article.id);
    if (cachedIdioms) {
      setDetectedIdioms(cachedIdioms);
      setIdiomScanCompleted(true);
      setIdiomError(null);
      return;
    }

    idiomRequestRef.current?.abort();
    const controller = new AbortController();
    idiomRequestRef.current = controller;

    setIdiomDetectionLoading(true);
    setIdiomError(null);
    setIdiomTooltip(null);

    try {
      const response = await fetch("/api/detect-idioms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          content: article.content,
          articleTitle: article.title,
        }),
      });

      const data = (await response.json()) as DetectedIdiom[] | { error?: string };
      if (!response.ok) {
        setIdiomError("error" in data ? data.error || "Could not detect idioms." : "Could not detect idioms.");
        return;
      }

      const nextIdioms = Array.isArray(data) ? data : [];
      idiomCacheRef.current.set(article.id, nextIdioms);
      setDetectedIdioms(nextIdioms);
      setIdiomScanCompleted(true);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      console.error("Detect idioms request failed:", error);
      setIdiomError("Could not detect idioms right now.");
    } finally {
      if (!controller.signal.aborted) {
        setIdiomDetectionLoading(false);
      }
    }
  };

  const plainArticleText = article.content.replace(/<[^>]+>/g, " ");
  const activeSelectionMode = selection
    ? selection.kind === "sentence"
      ? "sentence"
      : selection.kind === "paragraph"
        ? "paragraph"
        : inferLookupMode(selection, lookupMode)
    : null;
  const selectionPrimaryLabel = selection?.kind === "sentence" ? "Look up" : "Translate";
  const showExplainAction =
    selection && selection.kind !== "sentence" && activeSelectionMode !== null && activeSelectionMode !== "vocab";

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <ProfileBootstrap />
      <ReaderControls
        key={article.id}
        fontSize={fontSize}
        lineSpacing={lineSpacing}
        lookupMode={lookupMode}
        articleTitle={article.title}
        articleSourceName={article.source_name}
        articleText={plainArticleText}
        articleUrl={article.url}
        readingProgress={readingProgress}
        readingHelperEnabled={readingHelperEnabled}
        readingHelperLoading={chunkingLoading}
        idiomDetectionLoading={idiomDetectionLoading}
        idiomCount={detectedIdioms.length}
        idiomScanCompleted={idiomScanCompleted}
        onFontSizeChange={handleFontSizeChange}
        onLineSpacingChange={handleLineSpacingChange}
        onLookupModeChange={handleLookupModeChange}
        onReadingHelperToggle={handleReadingHelperToggle}
        onDetectIdioms={() => void handleDetectIdioms()}
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
              {readingHelperEnabled && !chunkingLoading && chunkedContent && (
                <span className="glass-chip inline-flex max-w-full items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-primary">
                  Reading helper on
                </span>
              )}
              {idiomScanCompleted && detectedIdioms.length > 0 && (
                <span className="glass-chip inline-flex max-w-full items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-orange-500">
                  {detectedIdioms.length} idioms highlighted
                </span>
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
            {(readingHelperEnabled || idiomScanCompleted || chunkingError || idiomError) && (
              <div className="mb-4 space-y-2">
                {readingHelperEnabled && (
                  <div className="glass-panel flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted">
                    {chunkingLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Preparing chunking and collocation guides...
                      </>
                    ) : chunkedContent ? (
                      <>Chunking helper is active for this article.</>
                    ) : (
                      <>Chunking helper is ready when the analysis completes.</>
                    )}
                  </div>
                )}

                {idiomScanCompleted && detectedIdioms.length > 0 && (
                  <div className="rounded-xl bg-orange-400/10 px-3 py-2 text-sm text-orange-500">
                    Tap the orange dashed phrases to see Thai meanings.
                  </div>
                )}

                {idiomScanCompleted && detectedIdioms.length === 0 && !idiomError && !idiomDetectionLoading && (
                  <div className="glass-panel rounded-xl px-3 py-2 text-sm text-muted">
                    No standout idioms or phrasal verbs were detected in this article.
                  </div>
                )}

                {chunkingError && (
                  <div className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                    {chunkingError}
                  </div>
                )}

                {idiomError && (
                  <div className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                    {idiomError}
                  </div>
                )}
              </div>
            )}

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

      {idiomTooltip && (
        <div
          ref={tooltipRef}
          className="pointer-events-auto fixed z-40 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-orange-400/20 bg-white/95 px-4 py-3 shadow-lg shadow-slate-950/15 dark:bg-slate-900/95"
          style={{
            left: idiomTooltip.x,
            top: idiomTooltip.y,
            transform:
              idiomTooltip.placement === "top"
                ? "translate(-50%, -100%)"
                : "translate(-50%, 0)",
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-500">
            {idiomTooltip.type === "phrasal_verb" ? "Phrasal Verb" : "Idiom"}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{idiomTooltip.phrase}</p>
          <p className="mt-2 text-sm leading-6 text-muted">{idiomTooltip.meaning}</p>
        </div>
      )}

      {!selection && selectionNotice && !lookupRequest && !sentenceLookup && !savedWordPreview && (
        <div className="fixed bottom-0 left-0 right-0 z-30 pb-safe">
          <div className="mx-auto max-w-lg px-4 pb-4">
            <div className="glass-panel text-safe-body rounded-xl px-4 py-3 text-sm text-warning">
              {selectionNotice}
            </div>
          </div>
        </div>
      )}

      {selection && activeSelectionMode && !lookupRequest && !sentenceLookup && !savedWordPreview && (
        <SelectionActionBar
          text={selection.text}
          mode={activeSelectionMode}
          primaryLabel={selectionPrimaryLabel}
          onTranslate={() => handleLookupAction("translate")}
          onExplain={showExplainAction ? () => handleLookupAction("explain") : undefined}
          onDismiss={clearSelection}
        />
      )}

      {savedWordPreview && !lookupRequest && !sentenceLookup && (
        <SavedWordPopup
          item={savedWordPreview}
          onClose={() => setSavedWordPreview(null)}
        />
      )}

      {sentenceLookup && !lookupRequest && (
        <SentencePopup
          selection={sentenceLookup}
          articleId={article.id}
          articleTitle={article.title}
          cacheRef={sentenceAnalysisCacheRef}
          onClose={() => setSentenceLookup(null)}
        />
      )}

      {lookupRequest && !sentenceLookup && (
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
