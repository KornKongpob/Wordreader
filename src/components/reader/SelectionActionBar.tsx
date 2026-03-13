"use client";

import { BookmarkPlus, Languages, Loader2, Sparkles, X } from "lucide-react";
import type { LookupMode } from "@/types";

interface SelectionActionBarProps {
  text: string;
  mode: LookupMode;
  primaryLabel: string;
  onPrimaryAction: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  onQuickSave?: () => void;
  quickSaveBusy?: boolean;
  notice?: string | null;
  onDismiss: () => void;
}

function getModeLabel(mode: LookupMode) {
  if (mode === "paragraph") return "Paragraph";
  if (mode === "sentence") return "Sentence";
  return "Word";
}

export default function SelectionActionBar({
  text,
  mode,
  primaryLabel,
  onPrimaryAction,
  secondaryLabel,
  onSecondaryAction,
  onQuickSave,
  quickSaveBusy = false,
  notice,
  onDismiss,
}: SelectionActionBarProps) {
  const gridColumns =
    onQuickSave && onSecondaryAction ? "sm:grid-cols-3" : "sm:grid-cols-2";

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

          <div className={`mt-3 grid grid-cols-1 gap-2 ${gridColumns}`}>
            <button
              type="button"
              onClick={onPrimaryAction}
              className="glow-button inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-xl px-3 py-3 text-center text-sm font-medium text-primary-foreground"
            >
              <Languages size={16} />
              {primaryLabel}
            </button>

            {onSecondaryAction && secondaryLabel ? (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="subtle-button inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-xl px-3 py-3 text-center text-sm font-medium text-foreground"
              >
                <Sparkles size={16} />
                {secondaryLabel}
              </button>
            ) : null}

            {onQuickSave ? (
              <button
                type="button"
                onClick={onQuickSave}
                disabled={quickSaveBusy}
                className="subtle-button inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-xl px-3 py-3 text-center text-sm font-medium text-foreground disabled:opacity-60"
              >
                {quickSaveBusy ? <Loader2 size={16} className="animate-spin" /> : <BookmarkPlus size={16} />}
                {quickSaveBusy ? "Saving..." : "Quick save"}
              </button>
            ) : null}
          </div>

          {notice ? (
            <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {notice}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
