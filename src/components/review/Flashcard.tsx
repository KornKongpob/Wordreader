"use client";

import { useState, type KeyboardEvent } from "react";
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

  const handleFlip = () => {
    setFlipped((current) => !current);
  };

  const handleFlipKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleFlip();
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex w-full items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/10">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs text-muted">
          {current}/{total}
        </span>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={handleFlip}
        onKeyDown={handleFlipKeyDown}
        className="glass-panel-strong flex min-h-[320px] w-full cursor-pointer flex-col items-center justify-center rounded-[2rem] p-6 text-center transition-transform active:scale-[0.99]"
      >
        {!flipped ? (
          <>
            <p className="editorial-label mb-3">Flashcard</p>
            <p className="mb-3 text-2xl font-bold">{word}</p>
            {part_of_speech && (
              <p className="mb-4 text-sm italic text-muted">{part_of_speech}</p>
            )}
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              <SpeakButton text={word} label="Word audio" />
              {example_sentence && (
                <SpeakButton text={example_sentence} label="Sentence audio" />
              )}
            </div>
            {example_sentence && (
              <p className="max-w-sm text-sm leading-relaxed text-muted">
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
            <p className="editorial-label mb-2">Meaning</p>
            <p className="mb-1 text-lg font-bold">{word}</p>
            <div className="my-3 h-0.5 w-12 rounded-full bg-primary/20" />
            <p className="mb-2 text-xl">{thai_meaning}</p>
            <p className="mb-4 text-sm text-muted">{english_meaning}</p>
            {contextual_meaning && (
              <p className="max-w-sm text-xs leading-relaxed text-muted">
                {contextual_meaning}
              </p>
            )}
          </>
        )}
      </div>

      {flipped && (
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            onClick={() => {
              setFlipped(false);
              onRate("again");
            }}
            className="subtle-button rounded-xl py-3 text-sm font-medium text-foreground transition active:scale-[0.97]"
          >
            Again today
          </button>
          <button
            onClick={() => {
              setFlipped(false);
              onRate("hard");
            }}
            className="glass-chip rounded-xl py-3 text-sm font-medium text-danger transition active:scale-[0.97]"
          >
            Hard
          </button>
          <button
            onClick={() => {
              setFlipped(false);
              onRate("medium");
            }}
            className="glass-chip rounded-xl py-3 text-sm font-medium text-warning transition active:scale-[0.97]"
          >
            Medium
          </button>
          <button
            onClick={() => {
              setFlipped(false);
              onRate("easy");
            }}
            className="glass-chip rounded-xl py-3 text-sm font-medium text-success transition active:scale-[0.97]"
          >
            Easy
          </button>
        </div>
      )}
    </div>
  );
}
