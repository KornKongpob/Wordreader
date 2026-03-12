"use client";

import { Languages, Sparkles, X } from "lucide-react";
import type { LookupMode } from "@/types";

interface SelectionActionBarProps {
  text: string;
  mode: LookupMode;
  onTranslate: () => void;
  onExplain?: () => void;
  onDismiss: () => void;
  primaryLabel?: string;
}

function getModeLabel(mode: LookupMode) {
  if (mode === "paragraph") return "Paragraph";
  if (mode === "sentence") return "Sentence";
  return "Word";
}

export default function SelectionActionBar({
  text,
  mode,
  onTranslate,
  onExplain,
  onDismiss,
  primaryLabel = "Translate",
}: SelectionActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pb-safe">
      <div className="mx-auto max-w-lg px-4 pb-4">
        <div className="glass-panel-strong rounded-[1.6rem] p-3 shadow-lg shadow-slate-950/10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2">
                <span className="glass-chip rounded-full px-3 py-1 text-xs font-medium text-primary">
                  {getModeLabel(mode)}
                </span>
              </div>
              <p className="text-safe-body line-clamp-2 text-sm font-medium">{text}</p>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              className="subtle-button rounded-xl p-2 text-muted transition hover:text-foreground"
              aria-label="Dismiss selection actions"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onTranslate}
              className="glow-button inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-xl px-3 py-3 text-center text-sm font-medium text-primary-foreground"
            >
              <Languages size={16} />
              {primaryLabel}
            </button>

            {mode !== "vocab" && onExplain ? (
              <button
                type="button"
                onClick={onExplain}
                className="subtle-button inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-xl px-3 py-3 text-center text-sm font-medium text-foreground"
              >
                <Sparkles size={16} />
                Explain
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
