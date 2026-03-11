"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";
import type { ReaderLookupStyle } from "@/types";
import {
  Sun,
  Moon,
  Minus,
  Plus,
  ArrowLeft,
  Type,
  X,
} from "lucide-react";
import Link from "next/link";

interface ReaderControlsProps {
  fontSize: number;
  lineSpacing: number;
  lookupMode: ReaderLookupStyle;
  onFontSizeChange: (size: number) => void;
  onLineSpacingChange: (spacing: number) => void;
  onLookupModeChange: (mode: ReaderLookupStyle) => void;
}

export default function ReaderControls({
  fontSize,
  lineSpacing,
  lookupMode,
  onFontSizeChange,
  onLineSpacingChange,
  onLookupModeChange,
}: ReaderControlsProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [showPanel, setShowPanel] = useState(false);
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

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <div ref={chromeRef} className="reader-chrome shrink-0 border-b soft-divider pt-safe">
      <div>
        <div className="px-3 pb-3 pt-3">
          <div className="glass-nav mx-auto flex h-14 max-w-2xl items-center justify-between rounded-[1.6rem] px-4">
            <Link
              href="/read"
              className="glass-chip flex items-center gap-1 rounded-full px-3 py-1.5 text-muted transition hover:text-foreground"
            >
              <ArrowLeft size={20} />
              <span className="text-sm">Back</span>
            </Link>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowPanel(!showPanel)}
                className={`rounded-xl p-2 transition ${
                  showPanel
                    ? "glass-chip text-primary"
                    : "subtle-button text-muted hover:text-foreground"
                }`}
                aria-label="Reading settings"
              >
                <Type size={20} />
              </button>

              <button
                onClick={toggleTheme}
                className="subtle-button rounded-xl p-2 text-muted transition hover:text-foreground"
                aria-label="Toggle dark mode"
              >
                {resolvedTheme === "dark" ? (
                  <Sun size={20} />
                ) : (
                  <Moon size={20} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPanel && (
        <div className="px-3 pb-3">
          <div className="glass-panel mx-auto max-w-2xl rounded-[1.5rem] px-4 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="editorial-label mb-1">Reader Controls</p>
                <span className="text-sm font-medium">Reading Settings</span>
              </div>
              <button
                onClick={() => setShowPanel(false)}
                className="subtle-button rounded-xl p-1.5 text-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            {/* Font size */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Font Size</span>
              <div className="flex items-center gap-3">
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
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Line Spacing</span>
              <div className="flex items-center gap-2">
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

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Lookup Style</span>
              <div className="flex items-center gap-2">
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
          </div>
        </div>
      )}
    </div>
  );
}
