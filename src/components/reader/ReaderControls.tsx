"use client";

import { useState } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";
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
  lookupMode: "word" | "phrase";
  onFontSizeChange: (size: number) => void;
  onLineSpacingChange: (spacing: number) => void;
  onLookupModeChange: (mode: "word" | "phrase") => void;
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

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <>
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm pt-safe">
        <div className="flex items-center justify-between h-12 px-4 max-w-2xl mx-auto">
          <Link
            href="/read"
            className="flex items-center gap-1 text-muted hover:text-foreground transition"
          >
            <ArrowLeft size={20} />
            <span className="text-sm">Back</span>
          </Link>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowPanel(!showPanel)}
              className={`p-2 rounded-lg transition ${
                showPanel
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:text-foreground"
              }`}
              aria-label="Reading settings"
            >
              <Type size={20} />
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted hover:text-foreground transition"
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

      {/* Settings panel */}
      {showPanel && (
        <div className="sticky top-12 z-30 border-b border-border bg-card">
          <div className="px-4 py-3 max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Reading Settings</span>
              <button
                onClick={() => setShowPanel(false)}
                className="p-1 text-muted hover:text-foreground"
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
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted hover:text-foreground transition"
                >
                  <Minus size={14} />
                </button>
                <span className="text-sm font-medium w-8 text-center">
                  {fontSize}
                </span>
                <button
                  onClick={() => onFontSizeChange(Math.min(28, fontSize + 2))}
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted hover:text-foreground transition"
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
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Lookup Mode</span>
              <div className="flex items-center gap-2">
                {(["word", "phrase"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onLookupModeChange(mode)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      lookupMode === mode
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {mode === "word" ? "Single word" : "Phrase"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
