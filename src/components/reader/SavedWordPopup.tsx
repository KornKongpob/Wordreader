"use client";

import Link from "next/link";
import { BookOpen, ExternalLink, X } from "lucide-react";
import SpeakButton from "@/components/common/SpeakButton";
import type { SavedVocabularyPreview } from "@/types";

interface SavedWordPopupProps {
  item: SavedVocabularyPreview;
  onClose: () => void;
}

export default function SavedWordPopup({ item, onClose }: SavedWordPopupProps) {
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-950/24 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="glass-panel-strong fixed bottom-0 left-0 right-0 z-40 max-h-[80dvh] overflow-y-auto rounded-t-[2rem] pb-safe animate-slide-up">
        <div className="mx-auto max-w-lg px-5 pb-6 pt-4">
          <div className="mb-3 flex justify-center">
            <div className="h-1 w-10 rounded-full bg-primary/20" />
          </div>

          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="editorial-label mb-2">Saved Word</p>
              <h3 className="text-lg font-bold">{item.word}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {item.part_of_speech && (
                  <span className="glass-chip rounded-full px-3 py-1 text-xs text-muted">
                    {item.part_of_speech}
                  </span>
                )}
                <span className="glass-chip rounded-full px-3 py-1 text-xs text-primary">
                  {item.difficulty}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <SpeakButton
                  text={item.pronunciation || item.word}
                  label="Word audio"
                />
                {item.last_source_name && (
                  <span className="glass-chip rounded-full px-3 py-1 text-xs text-muted">
                    {item.last_source_name}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="subtle-button rounded-xl p-2 text-muted transition hover:text-foreground"
              aria-label="Close saved word card"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="glass-panel rounded-xl p-3">
              <p className="mb-1 text-xs text-muted">Thai meaning</p>
              <p className="text-lg font-medium">{item.thai_meaning}</p>
            </div>

            <div className="glass-panel rounded-xl p-3">
              <p className="mb-1 text-xs text-muted">English meaning</p>
              <p className="text-sm leading-relaxed">{item.english_meaning}</p>
            </div>
          </div>

          <Link
            href={`/vocabulary/${item.id}`}
            className="glow-button mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-primary-foreground"
          >
            <BookOpen size={16} />
            Open vocabulary detail
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>
    </>
  );
}
