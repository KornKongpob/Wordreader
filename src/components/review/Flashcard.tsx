"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import SpeakButton from "@/components/common/SpeakButton";

interface FlashcardProps {
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  example_sentence: string;
  contextual_meaning: string;
  onRate: (rating: "again" | "easy" | "medium" | "hard") => void;
  current: number;
  total: number;
}

export default function Flashcard({
  word,
  thai_meaning,
  english_meaning,
  part_of_speech,
  example_sentence,
  contextual_meaning,
  onRate,
  current,
  total,
}: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Progress */}
      <div className="w-full flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted shrink-0">
          {current}/{total}
        </span>
      </div>

      {/* Card */}
      <button
        onClick={() => setFlipped(!flipped)}
        className="w-full min-h-[300px] p-6 rounded-2xl border border-border bg-card shadow-sm flex flex-col items-center justify-center text-center active:scale-[0.99] transition-transform"
      >
        {!flipped ? (
          <>
            {/* Front — word + sentence */}
            <p className="text-2xl font-bold mb-3">{word}</p>
            {part_of_speech && (
              <p className="text-sm text-muted italic mb-4">{part_of_speech}</p>
            )}
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              <SpeakButton text={word} label="Word audio" />
              {example_sentence && (
                <SpeakButton text={example_sentence} label="Sentence audio" />
              )}
            </div>
            {example_sentence && (
              <p className="text-sm text-muted leading-relaxed max-w-sm">
                &ldquo;{example_sentence}&rdquo;
              </p>
            )}
            <div className="mt-6 flex items-center gap-1 text-xs text-muted">
              <RotateCcw size={12} />
              <span>Tap to reveal</span>
            </div>
          </>
        ) : (
          <>
            {/* Back — meanings */}
            <p className="text-lg font-bold mb-1">{word}</p>
            <div className="w-12 h-0.5 rounded-full bg-border my-3" />
            <p className="text-xl mb-2">{thai_meaning}</p>
            <p className="text-sm text-muted mb-4">{english_meaning}</p>
            {contextual_meaning && (
              <p className="text-xs text-muted leading-relaxed max-w-sm">
                {contextual_meaning}
              </p>
            )}
          </>
        )}
      </button>

      {/* Rating buttons — only shown when flipped */}
      {flipped && (
        <div className="w-full grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            onClick={() => {
              setFlipped(false);
              onRate("again");
            }}
            className="py-3 rounded-xl border border-border text-foreground font-medium text-sm active:scale-[0.97] transition"
          >
            Again today
          </button>
          <button
            onClick={() => {
              setFlipped(false);
              onRate("hard");
            }}
            className="py-3 rounded-xl bg-danger/15 text-danger font-medium text-sm active:scale-[0.97] transition"
          >
            Hard
          </button>
          <button
            onClick={() => {
              setFlipped(false);
              onRate("medium");
            }}
            className="py-3 rounded-xl bg-warning/15 text-warning font-medium text-sm active:scale-[0.97] transition"
          >
            Medium
          </button>
          <button
            onClick={() => {
              setFlipped(false);
              onRate("easy");
            }}
            className="py-3 rounded-xl bg-success/15 text-success font-medium text-sm active:scale-[0.97] transition"
          >
            Easy
          </button>
        </div>
      )}
    </div>
  );
}
