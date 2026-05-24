"use client";

import Link from "next/link";
import { FolderOpen, RotateCcw, Star } from "lucide-react";

interface VocabCardProps {
  id: string;
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  difficulty: "easy" | "medium" | "hard";
  lemma?: string;
  cefr_level?: string;
  created_at: string;
  tags?: string[];
  folder_name?: string;
  starred?: boolean;
  notes?: string;
  last_source_name?: string;
  due_now?: boolean;
}

export default function VocabCard({
  id,
  word,
  thai_meaning,
  part_of_speech,
  difficulty,
  lemma = "",
  cefr_level = "",
  created_at,
  tags = [],
  folder_name = "General",
  starred = false,
  notes = "",
  last_source_name = "",
  due_now = false,
}: VocabCardProps) {
  const difficultyColor = {
    easy: "bg-success/15 text-success",
    medium: "bg-warning/15 text-warning",
    hard: "bg-danger/15 text-danger",
  };

  const dateStr = new Date(created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Link
      href={`/vocabulary/${id}`}
      className="glass-panel block rounded-2xl p-4 transition active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-start gap-x-2 gap-y-1">
            <p className="text-safe-title line-clamp-2 min-w-0 flex-1 font-semibold">{word}</p>
            {starred && <Star size={14} className="fill-warning text-warning" />}
            {part_of_speech && (
              <span className="shrink-0 text-xs text-muted">{part_of_speech}</span>
            )}
          </div>
          <p className="text-safe-body line-clamp-2 text-sm text-muted">{thai_meaning}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            {cefr_level && (
              <span className="glass-chip rounded-full px-2 py-1 text-primary">
                {cefr_level}
              </span>
            )}
            {lemma && lemma.toLowerCase() !== word.toLowerCase() && (
              <span className="glass-chip max-w-full rounded-full px-2 py-1 text-muted">
                <span className="chip-truncate">lemma: {lemma}</span>
              </span>
            )}
            {due_now && (
              <span className="glass-chip inline-flex items-center gap-1 rounded-full px-2 py-1 text-primary">
                <RotateCcw size={11} />
                Due now
              </span>
            )}
            {folder_name && (
              <span className="glass-chip inline-flex items-center gap-1 rounded-full px-2 py-1 text-muted">
                <FolderOpen size={11} />
                {folder_name}
              </span>
            )}
            {last_source_name && (
              <span className="glass-chip max-w-full rounded-full px-2 py-1 text-muted sm:max-w-[12rem]">
                <span className="chip-truncate">{last_source_name}</span>
              </span>
            )}
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="glass-chip rounded-full px-2 py-1 text-primary"
              >
                #{tag}
              </span>
            ))}
          </div>
          {notes.trim() && (
            <p className="text-safe-body mt-3 line-clamp-2 text-xs text-muted">{notes.trim()}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${difficultyColor[difficulty]}`}
          >
            {difficulty}
          </span>
          <span className="text-[10px] text-muted">{dateStr}</span>
        </div>
      </div>
    </Link>
  );
}
