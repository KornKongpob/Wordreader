"use client";

import { useState, type KeyboardEvent } from "react";
import { RotateCcw } from "lucide-react";
import SpeakButton from "@/components/common/SpeakButton";
import ReviewProgress from "./ReviewProgress";
import ReviewRatingControls from "./ReviewRatingControls";
import type { ReviewPracticeProps } from "./types";

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
  ratingBusy = false,
  ratingStatus = "",
}: ReviewPracticeProps) {
  const [flipped, setFlipped] = useState(false);

  const handleFlip = () => {
    if (ratingBusy) return;
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
      <ReviewProgress current={current} total={total} />

      <div
        role="button"
        tabIndex={0}
        onClick={handleFlip}
        onKeyDown={handleFlipKeyDown}
        aria-disabled={ratingBusy}
        className={`glass-panel-strong flex min-h-[320px] w-full flex-col items-center justify-center rounded-[2rem] p-6 text-center transition-transform active:scale-[0.99] ${
          ratingBusy ? "cursor-wait opacity-80" : "cursor-pointer"
        }`}
      >
        {!flipped ? (
          <>
            <p className="editorial-label mb-3">Flashcard</p>
            <p className="text-safe-title mb-3 text-2xl font-bold">{word}</p>
            {part_of_speech && (
              <p className="text-safe-meta mb-4 text-sm italic text-muted">{part_of_speech}</p>
            )}
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              <SpeakButton text={word} label="Word audio" />
              {example_sentence && (
                <SpeakButton text={example_sentence} label="Sentence audio" />
              )}
            </div>
            {example_sentence && (
              <p className="text-safe-body max-w-sm text-sm text-muted">
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
            <p className="text-safe-title mb-1 text-lg font-bold">{word}</p>
            <div className="my-3 h-0.5 w-12 rounded-full bg-primary/20" />
            <p className="text-safe-title mb-2 text-xl">{thai_meaning}</p>
            <p className="text-safe-body mb-4 text-sm text-muted">{english_meaning}</p>
            {contextual_meaning && (
              <p className="text-safe-body max-w-sm text-xs text-muted">
                {contextual_meaning}
              </p>
            )}
          </>
        )}
      </div>

      {flipped && (
        <ReviewRatingControls
          onRate={onRate}
          ratingBusy={ratingBusy}
          ratingStatus={ratingStatus}
          onBeforeRate={() => setFlipped(false)}
        />
      )}
    </div>
  );
}
