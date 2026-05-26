"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { createClozePrompt, getReviewAnswerFeedback } from "@/lib/review-modes";
import ReviewProgress from "./ReviewProgress";
import ReviewRatingControls from "./ReviewRatingControls";
import type { ReviewPracticeProps } from "./types";

export default function ClozeReview({
  word,
  thai_meaning,
  english_meaning,
  example_sentence,
  contextual_meaning,
  onRate,
  current,
  total,
  ratingBusy = false,
  ratingStatus = "",
}: ReviewPracticeProps) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const cloze = useMemo(
    () => createClozePrompt(example_sentence, word),
    [example_sentence, word]
  );
  const feedback = useMemo(
    () => (submitted ? getReviewAnswerFeedback(cloze.answer, answer) : null),
    [answer, cloze.answer, submitted]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!answer.trim() || ratingBusy) return;
    setSubmitted(true);
  };

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <ReviewProgress current={current} total={total} />

      <div className="glass-panel-strong flex min-h-[320px] w-full flex-col justify-center rounded-[2rem] p-6">
        <p className="editorial-label mb-3 text-center">Cloze</p>
        <div className="space-y-4 text-center">
          <p className="text-safe-title whitespace-pre-wrap text-xl font-semibold leading-relaxed">
            {cloze.found ? cloze.prompt : cloze.prompt || "_____"}
          </p>
          {!cloze.found && (
            <p className="text-safe-body text-xs text-muted">
              Use the saved meaning and context as clues.
            </p>
          )}
          <div className="rounded-2xl bg-primary/5 px-4 py-3">
            {thai_meaning && (
              <p className="text-safe-title text-base font-semibold">{thai_meaning}</p>
            )}
            {english_meaning && (
              <p className="text-safe-body mt-1 text-sm text-muted">{english_meaning}</p>
            )}
            {contextual_meaning && (
              <p className="text-safe-body mt-2 text-xs text-muted">{contextual_meaning}</p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            value={answer}
            onChange={(event) => {
              setAnswer(event.target.value);
              if (submitted) setSubmitted(false);
            }}
            disabled={ratingBusy}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            aria-label="Fill the blank"
            placeholder="Fill the blank"
            className="w-full rounded-2xl border border-border bg-background/80 px-4 py-3 text-center text-base outline-none transition focus:border-primary disabled:cursor-wait disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={ratingBusy || !answer.trim()}
            className="glow-button flex min-h-[3rem] w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Check answer
          </button>
        </form>

        {feedback && (
          <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4 text-sm">
            <div className="mb-2 flex items-center justify-center gap-2 font-semibold">
              {feedback.isCorrect ? (
                <CheckCircle2 size={16} className="text-success" />
              ) : (
                <XCircle size={16} className="text-warning" />
              )}
              <span>{feedback.isCorrect ? "Correct" : `${feedback.score}% match`}</span>
            </div>
            {!feedback.isCorrect && (
              <div className="space-y-2 text-muted">
                <p className="text-center">
                  Answer: <span className="font-medium text-foreground">{cloze.answer}</span>
                </p>
                {feedback.missing.length > 0 && (
                  <p>Missing: {feedback.missing.join(", ")}</p>
                )}
                {feedback.extra.length > 0 && <p>Extra: {feedback.extra.join(", ")}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {submitted && (
        <ReviewRatingControls
          onRate={onRate}
          ratingBusy={ratingBusy}
          ratingStatus={ratingStatus}
        />
      )}
    </div>
  );
}
