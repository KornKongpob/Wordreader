"use client";

import Link from "next/link";

interface VocabCardProps {
  id: string;
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  difficulty: "easy" | "medium" | "hard";
  created_at: string;
}

export default function VocabCard({
  id,
  word,
  thai_meaning,
  part_of_speech,
  difficulty,
  created_at,
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
      className="flex items-center justify-between p-4 rounded-xl border border-border bg-card active:scale-[0.98] transition"
    >
      <div className="flex-1 min-w-0 mr-3">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-semibold truncate">{word}</p>
          {part_of_speech && (
            <span className="text-xs text-muted shrink-0">
              {part_of_speech}
            </span>
          )}
        </div>
        <p className="text-sm text-muted truncate">{thai_meaning}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${difficultyColor[difficulty]}`}
        >
          {difficulty}
        </span>
        <span className="text-[10px] text-muted">{dateStr}</span>
      </div>
    </Link>
  );
}
