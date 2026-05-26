"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Eye, Pause, Play, Volume2, XCircle } from "lucide-react";
import { getReviewAnswerFeedback } from "@/lib/review-modes";
import ReviewProgress from "./ReviewProgress";
import ReviewRatingControls from "./ReviewRatingControls";
import type { ReviewPracticeProps } from "./types";

type SpeechState = "idle" | "speaking" | "paused";

function pickEnglishVoice(voices: SpeechSynthesisVoice[]) {
  return voices.find((voice) => /^en(-|_)/i.test(voice.lang)) ?? voices[0] ?? null;
}

export default function ListeningReview({
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
  const [revealed, setRevealed] = useState(false);
  const [speechState, setSpeechState] = useState<SpeechState>("idle");
  const [speechError, setSpeechError] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const listenText = (example_sentence || word).trim();
  const showAnswer = submitted || revealed;
  const feedback = useMemo(
    () => (submitted ? getReviewAnswerFeedback(listenText, answer) : null),
    [answer, listenText, submitted]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const synth = window.speechSynthesis;
    const updateVoices = () => setVoices(synth.getVoices());

    updateVoices();
    synth.addEventListener("voiceschanged", updateVoices);

    return () => {
      synth.removeEventListener("voiceschanged", updateVoices);
      if (utteranceRef.current) {
        synth.cancel();
        utteranceRef.current = null;
      }
    };
  }, []);

  const handlePlay = () => {
    if (ratingBusy) return;

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeechError("Speech audio is not available in this browser.");
      return;
    }

    const synth = window.speechSynthesis;

    if (speechState === "speaking" && synth.speaking && !synth.paused) {
      synth.pause();
      setSpeechState("paused");
      return;
    }

    if (speechState === "paused" && synth.paused) {
      synth.resume();
      setSpeechState("speaking");
      return;
    }

    synth.cancel();
    setSpeechError("");

    const utterance = new SpeechSynthesisUtterance(listenText);
    const voice = pickEnglishVoice(voices);

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "en-US";
    }

    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeechState("speaking");
    utterance.onpause = () => setSpeechState("paused");
    utterance.onresume = () => setSpeechState("speaking");
    utterance.onend = () => {
      setSpeechState("idle");
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setSpeechState("idle");
      utteranceRef.current = null;
      setSpeechError("Could not play this audio. Try again or reveal the text.");
    };

    utteranceRef.current = utterance;
    synth.speak(utterance);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!answer.trim() || ratingBusy) return;
    setSubmitted(true);
  };

  const PlayIcon = speechState === "speaking" ? Pause : speechState === "paused" ? Play : Volume2;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <ReviewProgress current={current} total={total} />

      <div className="glass-panel-strong flex min-h-[320px] w-full flex-col justify-center rounded-[2rem] p-6">
        <p className="editorial-label mb-3 text-center">Listening</p>
        <div className="space-y-4 text-center">
          <button
            type="button"
            onClick={handlePlay}
            disabled={ratingBusy}
            className="glow-button mx-auto flex min-h-[4rem] w-full max-w-xs items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-semibold text-primary-foreground transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          >
            <PlayIcon size={20} />
            {speechState === "speaking" ? "Pause audio" : "Play audio"}
          </button>
          {speechError && <p className="text-safe-body text-sm text-danger">{speechError}</p>}
          {showAnswer ? (
            <div className="rounded-2xl bg-primary/5 px-4 py-4">
              <p className="text-safe-title text-lg font-semibold">{listenText}</p>
              {listenText !== word && (
                <p className="mt-2 text-sm font-medium text-primary">{word}</p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-primary/5 px-4 py-4">
              <p className="text-3xl font-bold text-muted">_____</p>
            </div>
          )}
          <div className="space-y-1 text-sm text-muted">
            {thai_meaning && <p className="text-safe-body">{thai_meaning}</p>}
            {english_meaning && <p className="text-safe-body">{english_meaning}</p>}
            {contextual_meaning && (
              <p className="text-safe-body text-xs">{contextual_meaning}</p>
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
            aria-label="Type what you heard"
            placeholder="Type what you heard"
            className="w-full rounded-2xl border border-border bg-background/80 px-4 py-3 text-center text-base outline-none transition focus:border-primary disabled:cursor-wait disabled:opacity-60"
          />
          <div className="grid grid-cols-2 gap-3">
            <button
              type="submit"
              disabled={ratingBusy || !answer.trim()}
              className="glow-button flex min-h-[3rem] items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 size={16} />
              Check
            </button>
            <button
              type="button"
              onClick={() => setRevealed(true)}
              disabled={ratingBusy}
              className="subtle-button flex min-h-[3rem] items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            >
              <Eye size={16} />
              Reveal
            </button>
          </div>
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
                {feedback.missing.length > 0 && (
                  <p>Missing: {feedback.missing.join(", ")}</p>
                )}
                {feedback.extra.length > 0 && <p>Extra: {feedback.extra.join(", ")}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {showAnswer && (
        <ReviewRatingControls
          onRate={onRate}
          ratingBusy={ratingBusy}
          ratingStatus={ratingStatus}
        />
      )}
    </div>
  );
}
