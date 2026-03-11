"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";
import type { ReaderLookupStyle } from "@/types";
import {
  BookOpenText,
  ExternalLink,
  Minus,
  Monitor,
  MoreHorizontal,
  Moon,
  Plus,
  Share2,
  StickyNote,
  Sun,
  Volume2,
  ArrowLeft,
  X,
} from "lucide-react";
import Link from "next/link";

interface ReaderControlsProps {
  fontSize: number;
  lineSpacing: number;
  lookupMode: ReaderLookupStyle;
  articleTitle: string;
  articleSourceName: string;
  articleText: string;
  articleUrl?: string | null;
  readingProgress: number;
  onFontSizeChange: (size: number) => void;
  onLineSpacingChange: (spacing: number) => void;
  onLookupModeChange: (mode: ReaderLookupStyle) => void;
  onJumpToNotes?: () => void;
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
  onFontSizeChange,
  onLineSpacingChange,
  onLookupModeChange,
  onJumpToNotes,
}: ReaderControlsProps) {
  const { theme, setTheme } = useTheme();
  const [showPanel, setShowPanel] = useState(false);
  const [panelNotice, setPanelNotice] = useState<string | null>(null);
  const chromeRef = useRef<HTMLDivElement>(null);

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

  const canOpenOriginal = Boolean(articleUrl && articleUrl.startsWith("http"));

  const handleReadAloud = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setPanelNotice("Read aloud is not available on this device.");
      return;
    }

    const text = articleText.replace(/\s+/g, " ").trim();
    if (!text) {
      setPanelNotice("This article does not have readable text yet.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 6000));
    utterance.lang = "en-US";
    utterance.rate = 0.96;
    window.speechSynthesis.speak(utterance);
    setPanelNotice("Reading aloud started.");
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
                aria-label="Read this article aloud"
              >
                <Volume2 size={18} />
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
                onClick={() => setShowPanel(false)}
                className="subtle-button shrink-0 rounded-xl p-1.5 text-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={handleShare}
                className="subtle-button inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground"
              >
                <Share2 size={16} />
                Share article
              </button>
              <button
                type="button"
                onClick={() => {
                  onJumpToNotes?.();
                  setPanelNotice("Jumped to notes.");
                }}
                disabled={!onJumpToNotes}
                className="subtle-button inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50"
              >
                <StickyNote size={16} />
                Jump to notes
              </button>
              <button
                type="button"
                onClick={handleReadAloud}
                className="subtle-button inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground"
              >
                <BookOpenText size={16} />
                Read aloud
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

            {/* Font size */}
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-safe-meta text-sm text-muted">Font Size</span>
              <div className="flex items-center gap-3 self-stretch sm:self-auto">
                <button
                  onClick={() => onFontSizeChange(Math.max(14, fontSize - 2))}
                  className="subtle-button flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:text-foreground"
                >
                  <Minus size={14} />
                </button>
                <span className="text-sm font-medium w-8 text-center">
                  {fontSize}
                </span>
                <button
                  onClick={() => onFontSizeChange(Math.min(28, fontSize + 2))}
                  className="subtle-button flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:text-foreground"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Line spacing */}
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-safe-meta text-sm text-muted">Line Spacing</span>
              <div className="flex flex-wrap items-center gap-2">
                {[1.4, 1.6, 1.8, 2.0].map((val) => (
                  <button
                    key={val}
                    onClick={() => onLineSpacingChange(val)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      lineSpacing === val
                        ? "glow-button text-primary-foreground"
                        : "subtle-button text-muted hover:text-foreground"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-safe-meta text-sm text-muted">Lookup Style</span>
              <div className="flex flex-wrap items-center gap-2">
                {(["word", "phrase"] as const).map((mode) => (
                  <button
                    key={mode}
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
