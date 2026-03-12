"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";
import type { ReaderLookupStyle } from "@/types";
import {
  ArrowLeft,
  BookOpenText,
  ExternalLink,
  Languages,
  Minus,
  Monitor,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Share2,
  StickyNote,
  Sun,
  Volume2,
  X,
} from "lucide-react";

type SpeechState = "idle" | "speaking" | "paused";

interface ReaderControlsProps {
  fontSize: number;
  lineSpacing: number;
  lookupMode: ReaderLookupStyle;
  articleTitle: string;
  articleSourceName: string;
  articleText: string;
  articleUrl?: string | null;
  readingProgress: number;
  readingHelperEnabled?: boolean;
  readingHelperLoading?: boolean;
  idiomDetectionLoading?: boolean;
  idiomCount?: number;
  idiomScanCompleted?: boolean;
  showLookupMode?: boolean;
  showAdvancedAiTools?: boolean;
  onFontSizeChange: (size: number) => void;
  onLineSpacingChange: (spacing: number) => void;
  onLookupModeChange: (mode: ReaderLookupStyle) => void;
  onReadingHelperToggle?: (enabled: boolean) => void;
  onDetectIdioms?: () => void;
  onJumpToNotes?: () => void;
}

function pickPreferredVoice(voices: SpeechSynthesisVoice[]) {
  const englishVoices = voices.filter((voice) => /^en(-|_)/i.test(voice.lang));
  const preferenceOrder = [
    /natural/i,
    /aria/i,
    /jenny/i,
    /guy/i,
    /samantha/i,
    /zira/i,
    /google us english/i,
    /microsoft/i,
  ];

  for (const pattern of preferenceOrder) {
    const preferred = englishVoices.find((voice) => pattern.test(voice.name));
    if (preferred) {
      return preferred;
    }
  }

  return englishVoices[0] ?? voices[0] ?? null;
}

export default function ReaderControls({
  fontSize,
  lineSpacing,
  lookupMode,
  articleTitle,
  articleSourceName,
  articleText,
  articleUrl,
  readingProgress,
  readingHelperEnabled = false,
  readingHelperLoading = false,
  idiomDetectionLoading = false,
  idiomCount = 0,
  idiomScanCompleted = false,
  showLookupMode = true,
  showAdvancedAiTools = true,
  onFontSizeChange,
  onLineSpacingChange,
  onLookupModeChange,
  onReadingHelperToggle,
  onDetectIdioms,
  onJumpToNotes,
}: ReaderControlsProps) {
  const { theme, setTheme } = useTheme();
  const [showPanel, setShowPanel] = useState(false);
  const [panelNotice, setPanelNotice] = useState<string | null>(null);
  const [speechState, setSpeechState] = useState<SpeechState>("idle");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const chromeRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const element = chromeRef.current;
    if (!element || typeof window === "undefined") return;

    const root = document.documentElement;
    const updateHeight = () => {
      root.style.setProperty("--reader-toolbar-offset", `${Math.ceil(element.offsetHeight)}px`);
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [showPanel]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const synth = window.speechSynthesis;
    const updateVoices = () => {
      setVoices(synth.getVoices());
    };

    updateVoices();
    synth.addEventListener("voiceschanged", updateVoices);

    return () => {
      synth.removeEventListener("voiceschanged", updateVoices);
      synth.cancel();
      utteranceRef.current = null;
    };
  }, []);

  const canOpenOriginal = Boolean(articleUrl && articleUrl.startsWith("http"));

  const startReadingAloud = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setPanelNotice("Read aloud is not available on this device.");
      return;
    }

    const text = articleText.replace(/\s+/g, " ").trim();
    if (!text) {
      setPanelNotice("This article does not have readable text yet.");
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text.slice(0, 12000));
    const voice = pickPreferredVoice(voices);

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "en-US";
    }

    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeechState("speaking");
    utterance.onpause = () => setSpeechState("paused");
    utterance.onresume = () => setSpeechState("speaking");
    utterance.onend = () => {
      setSpeechState("idle");
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setSpeechState("idle");
      utteranceRef.current = null;
      setPanelNotice("Read aloud stopped unexpectedly.");
    };

    utteranceRef.current = utterance;
    synth.speak(utterance);
    setPanelNotice("Reading aloud started.");
  };

  const handleReadAloud = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setPanelNotice("Read aloud is not available on this device.");
      return;
    }

    const synth = window.speechSynthesis;

    if (speechState === "speaking" && synth.speaking && !synth.paused) {
      synth.pause();
      setSpeechState("paused");
      setPanelNotice("Reading aloud paused.");
      return;
    }

    if (speechState === "paused" && synth.paused) {
      synth.resume();
      setSpeechState("speaking");
      setPanelNotice("Reading aloud resumed.");
      return;
    }

    startReadingAloud();
  };

  const handleShare = async () => {
    const shareUrl =
      canOpenOriginal && articleUrl
        ? articleUrl
        : typeof window !== "undefined"
          ? window.location.href
          : "";

    if (!shareUrl) {
      setPanelNotice("No shareable link is available for this article.");
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: articleTitle,
          text: `Read "${articleTitle}" in WordReader`,
          url: shareUrl,
        });
        setPanelNotice("Share sheet opened.");
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setPanelNotice("Link copied to clipboard.");
        return;
      }

      setPanelNotice("Sharing is not available on this device.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setPanelNotice("Could not share this article right now.");
    }
  };

  const speechIcon =
    speechState === "speaking" ? Pause : speechState === "paused" ? Play : Volume2;
  const SpeechIcon = speechIcon;
  const speechLabel =
    speechState === "speaking"
      ? "Pause reading"
      : speechState === "paused"
        ? "Resume reading"
        : "Read aloud";

  return (
    <div ref={chromeRef} className="reader-chrome shrink-0 border-b soft-divider pt-safe">
      <div>
        <div className="px-3 pb-3 pt-3">
          <div className="glass-nav mx-auto flex min-h-14 max-w-3xl items-center gap-2 rounded-[1.6rem] px-3 py-2 sm:px-4">
            <Link
              href="/read"
              className="glass-chip inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-muted transition hover:text-foreground"
            >
              <ArrowLeft size={20} />
              <span className="text-sm">Back</span>
            </Link>

            <div className="glass-chip min-w-0 flex-1 rounded-full px-3 py-1.5 text-center">
              <p className="chip-truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                {articleSourceName}
              </p>
              <p className="text-safe-meta mt-0.5 text-xs text-muted">
                {readingProgress}% read
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={handleReadAloud}
                className="subtle-button rounded-xl p-2 text-muted transition hover:text-foreground"
                aria-label={speechLabel}
                title={speechLabel}
              >
                <SpeechIcon size={18} />
              </button>

              {canOpenOriginal && articleUrl ? (
                <a
                  href={articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="subtle-button rounded-xl p-2 text-muted transition hover:text-foreground"
                  aria-label="Open original article"
                >
                  <ExternalLink size={18} />
                </a>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setPanelNotice(null);
                  setShowPanel((current) => !current);
                }}
                className={`rounded-xl p-2 transition ${
                  showPanel
                    ? "glass-chip text-primary"
                    : "subtle-button text-muted hover:text-foreground"
                }`}
                aria-label="More reader tools"
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPanel && (
        <div className="px-3 pb-3">
          <div className="glass-panel mx-auto max-w-2xl space-y-4 rounded-[1.5rem] px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="editorial-label mb-1">Reader Tools</p>
                <span className="text-safe-title text-sm font-medium">
                  Reading Settings And Quick Actions
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPanel(false)}
                className="subtle-button shrink-0 rounded-xl p-1.5 text-muted hover:text-foreground"
                aria-label="Close reader tools"
              >
                <X size={16} />
              </button>
            </div>

            <div
              className={`grid gap-2 ${
                onJumpToNotes ? "sm:grid-cols-3" : "sm:grid-cols-2"
              }`}
            >
              <button
                type="button"
                onClick={handleShare}
                className="subtle-button inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground"
              >
                <Share2 size={16} />
                Share article
              </button>
              {onJumpToNotes && (
                <button
                  type="button"
                  onClick={() => {
                    onJumpToNotes();
                    setPanelNotice("Jumped to notes.");
                  }}
                  className="subtle-button inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground"
                >
                  <StickyNote size={16} />
                  Jump to notes
                </button>
              )}
              <button
                type="button"
                onClick={handleReadAloud}
                className="subtle-button inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground"
              >
                <BookOpenText size={16} />
                {speechLabel}
              </button>
            </div>

            <div>
              <p className="editorial-label mb-2">Theme</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                  { value: "system", label: "System", icon: Monitor },
                ] as const).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      theme === value
                        ? "glow-button text-primary-foreground"
                        : "glass-chip text-muted hover:text-foreground"
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-safe-meta text-sm text-muted">Font Size</span>
              <div className="flex items-center gap-3 self-stretch sm:self-auto">
                <button
                  type="button"
                  onClick={() => onFontSizeChange(Math.max(14, fontSize - 2))}
                  className="subtle-button flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:text-foreground"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-sm font-medium">{fontSize}</span>
                <button
                  type="button"
                  onClick={() => onFontSizeChange(Math.min(28, fontSize + 2))}
                  className="subtle-button flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:text-foreground"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-safe-meta text-sm text-muted">Line Spacing</span>
              <div className="flex flex-wrap items-center gap-2">
                {[1.4, 1.6, 1.8, 2].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onLineSpacingChange(value)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      lineSpacing === value
                        ? "glow-button text-primary-foreground"
                        : "subtle-button text-muted hover:text-foreground"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            {showLookupMode && (
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-safe-meta text-sm text-muted">Lookup Style</span>
                <div className="flex flex-wrap items-center gap-2">
                  {(["word", "phrase"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onLookupModeChange(mode)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        lookupMode === mode
                          ? "glow-button text-primary-foreground"
                          : "subtle-button text-muted hover:text-foreground"
                      }`}
                    >
                      {mode === "word" ? "Word focus" : "Smart"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showAdvancedAiTools && (
              <div className="space-y-3">
                <div className="flex flex-col items-start gap-3 rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">Reading Helper (Chunking)</p>
                    <p className="text-safe-meta text-xs text-muted">
                      Adds pause bars and collocation grouping for faster scanning.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onReadingHelperToggle?.(!readingHelperEnabled)}
                    disabled={!onReadingHelperToggle || readingHelperLoading}
                    className={`inline-flex min-h-10 min-w-24 items-center justify-center rounded-full px-4 text-sm font-medium transition disabled:opacity-50 ${
                      readingHelperEnabled
                        ? "glow-button text-primary-foreground"
                        : "subtle-button text-muted hover:text-foreground"
                    }`}
                  >
                    {readingHelperLoading ? "Loading..." : readingHelperEnabled ? "On" : "Off"}
                  </button>
                </div>

                <div className="flex flex-col items-start gap-3 rounded-2xl border border-orange-400/20 bg-orange-400/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">Detect Idioms</p>
                      {idiomScanCompleted && (
                        <span className="rounded-full bg-orange-400/15 px-2.5 py-1 text-xs font-medium text-orange-500">
                          {idiomCount} found
                        </span>
                      )}
                    </div>
                    <p className="text-safe-meta text-xs text-muted">
                      Highlight tricky idioms and phrasal verbs in the article.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onDetectIdioms}
                    disabled={!onDetectIdioms || idiomDetectionLoading}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-orange-400/30 bg-white/70 px-4 text-sm font-medium text-orange-500 transition hover:bg-white disabled:opacity-50 dark:bg-slate-900/60 dark:hover:bg-slate-900"
                  >
                    <Languages size={15} />
                    {idiomDetectionLoading
                      ? "Scanning..."
                      : idiomScanCompleted
                        ? "Rescan idioms"
                        : "Detect idioms"}
                  </button>
                </div>
              </div>
            )}

            {panelNotice && (
              <div className="rounded-xl bg-primary/8 px-3 py-2 text-sm text-primary">
                {panelNotice}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
