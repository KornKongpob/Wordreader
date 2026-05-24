"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Eye,
  Pause,
  Play,
  Repeat,
} from "lucide-react";
import { compareDictation, type DictationComparison } from "@/lib/text-compare";
import { extractSentencesFromText } from "@/lib/text-segments";
import type { PreferredAccent } from "@/types";

type ListeningSpeechState = "idle" | "speaking" | "paused";
type ListeningMode = "listen" | "shadow" | "dictation";
type ShadowRating = "Again" | "Good" | "Easy";

interface ReaderListeningPanelProps {
  articleText: string;
  preferredAccent?: PreferredAccent;
  onBeforeSpeak?: () => void;
}

const SPEED_OPTIONS = [0.75, 0.9, 1, 1.15] as const;
const LISTENING_MODES: Array<{ id: ListeningMode; label: string }> = [
  { id: "listen", label: "Listen" },
  { id: "shadow", label: "Shadow" },
  { id: "dictation", label: "Dictation" },
];
const SHADOW_RATINGS: ShadowRating[] = ["Again", "Good", "Easy"];

const ACCENT_LABELS: Record<PreferredAccent, string> = {
  us: "US accent",
  uk: "UK accent",
  au: "Australian accent",
  any: "Any English accent",
};

const ACCENT_LANG_PREFIX: Record<Exclude<PreferredAccent, "any">, string> = {
  us: "en-US",
  uk: "en-GB",
  au: "en-AU",
};

function pickVoice(voices: SpeechSynthesisVoice[], preferredAccent: PreferredAccent) {
  const englishVoices = voices.filter((voice) => /^en(-|_)/i.test(voice.lang));

  if (preferredAccent !== "any") {
    const langPrefix = ACCENT_LANG_PREFIX[preferredAccent].toLowerCase();
    const preferred = englishVoices.find((voice) =>
      voice.lang.toLowerCase().startsWith(langPrefix)
    );

    if (preferred) {
      return preferred;
    }
  }

  return englishVoices[0] ?? voices[0] ?? null;
}

export default function ReaderListeningPanel({
  articleText,
  preferredAccent = "any",
  onBeforeSpeak,
}: ReaderListeningPanelProps) {
  const sentences = useMemo(() => extractSentencesFromText(articleText), [articleText]);
  const [mode, setMode] = useState<ListeningMode>("listen");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speechState, setSpeechState] = useState<ListeningSpeechState>("idle");
  const [repeatSentence, setRepeatSentence] = useState(false);
  const [rate, setRate] = useState<(typeof SPEED_OPTIONS)[number]>(0.9);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [shadowRatings, setShadowRatings] = useState<Record<number, ShadowRating>>({});
  const [dictationText, setDictationText] = useState("");
  const [dictationResult, setDictationResult] = useState<DictationComparison | null>(null);
  const [showDictationAnswer, setShowDictationAnswer] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speakSentenceRef = useRef<(sentenceIndex: number) => void>(() => {});
  const activeIndexRef = useRef(0);
  const repeatRef = useRef(repeatSentence);
  const isMountedRef = useRef(true);

  const currentSentence = sentences[currentIndex] ?? null;
  const selectedVoice = useMemo(
    () => pickVoice(voices, preferredAccent),
    [preferredAccent, voices]
  );
  const voiceHint = selectedVoice
    ? `${ACCENT_LABELS[preferredAccent]} - ${selectedVoice.name}`
    : `${ACCENT_LABELS[preferredAccent]} when available`;
  const shouldHideSentence = mode === "dictation" && !showDictationAnswer;

  useEffect(() => {
    repeatRef.current = repeatSentence;
  }, [repeatSentence]);

  useEffect(() => {
    isMountedRef.current = true;

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return () => {
        isMountedRef.current = false;
      };
    }

    const synth = window.speechSynthesis;
    const updateVoices = () => {
      setVoices(synth.getVoices());
    };

    updateVoices();
    synth.addEventListener("voiceschanged", updateVoices);

    return () => {
      isMountedRef.current = false;
      synth.removeEventListener("voiceschanged", updateVoices);

      if (utteranceRef.current) {
        synth.cancel();
        utteranceRef.current = null;
      }
    };
  }, []);

  const stopCurrentSpeech = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    if (utteranceRef.current) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }

    setSpeechState("idle");
  }, []);

  const speakSentence = useCallback(
    (sentenceIndex: number) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setNotice("Listening practice is not available on this device.");
        return;
      }

      const sentence = sentences[sentenceIndex];
      if (!sentence) {
        setNotice("No sentence is selected.");
        return;
      }

      onBeforeSpeak?.();
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(sentence.text);
      const voice = pickVoice(voices, preferredAccent);

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang =
          preferredAccent === "uk"
            ? "en-GB"
            : preferredAccent === "au"
              ? "en-AU"
              : "en-US";
      }

      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.onstart = () => {
        if (!isMountedRef.current) return;
        setSpeechState("speaking");
        setNotice(null);
      };
      utterance.onpause = () => {
        if (!isMountedRef.current) return;
        setSpeechState("paused");
      };
      utterance.onresume = () => {
        if (!isMountedRef.current) return;
        setSpeechState("speaking");
      };
      utterance.onend = () => {
        if (!isMountedRef.current) return;
        utteranceRef.current = null;
        setSpeechState("idle");

        if (repeatRef.current && activeIndexRef.current === sentenceIndex) {
          window.setTimeout(() => {
            if (isMountedRef.current) {
              speakSentenceRef.current(sentenceIndex);
            }
          }, 120);
        }
      };
      utterance.onerror = () => {
        if (!isMountedRef.current) return;
        utteranceRef.current = null;
        setSpeechState("idle");
        setNotice("Listening playback stopped unexpectedly.");
      };

      utteranceRef.current = utterance;
      activeIndexRef.current = sentenceIndex;
      setCurrentIndex(sentenceIndex);
      window.speechSynthesis.speak(utterance);
    },
    [onBeforeSpeak, preferredAccent, rate, sentences, voices]
  );

  useEffect(() => {
    speakSentenceRef.current = speakSentence;
  }, [speakSentence]);

  const handlePlayPause = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setNotice("Listening practice is not available on this device.");
      return;
    }

    if (speechState === "speaking" && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setSpeechState("paused");
      return;
    }

    if (speechState === "paused" && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setSpeechState("speaking");
      return;
    }

    speakSentence(currentIndex);
  };

  const resetDictationState = () => {
    setDictationText("");
    setDictationResult(null);
    setShowDictationAnswer(false);
  };

  const handleModeChange = (nextMode: ListeningMode) => {
    setMode(nextMode);
    setNotice(null);
    resetDictationState();
  };

  const handleSubmitDictation = () => {
    if (!currentSentence) {
      return;
    }

    setDictationResult(compareDictation(currentSentence.text, dictationText));
  };

  const moveToSentence = (nextIndex: number) => {
    const boundedIndex = Math.min(sentences.length - 1, Math.max(0, nextIndex));
    const shouldContinuePlaying = speechState === "speaking" || speechState === "paused";

    setCurrentIndex(boundedIndex);
    activeIndexRef.current = boundedIndex;
    resetDictationState();

    if (shouldContinuePlaying) {
      speakSentence(boundedIndex);
    } else {
      stopCurrentSpeech();
    }
  };

  if (sentences.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 px-4 py-4 text-sm text-muted">
        This article does not have enough sentence text for listening practice.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Listening Practice</p>
          <p className="text-safe-meta mt-1 text-xs text-muted">{voiceHint}</p>
        </div>
        <span className="glass-chip self-start rounded-full px-3 py-1 text-xs text-muted">
          {currentIndex + 1}/{sentences.length}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        {LISTENING_MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleModeChange(item.id)}
            className={`min-h-10 rounded-xl px-2 py-2 text-xs font-medium transition ${
              mode === item.id
                ? "glow-button text-primary-foreground"
                : "subtle-button text-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="glass-panel rounded-2xl px-4 py-4">
        <p className="editorial-label mb-2">Current Sentence</p>
        <p className="text-safe-body text-base leading-7 text-foreground">
          {shouldHideSentence
            ? "Sentence hidden. Listen first, then type what you heard."
            : currentSentence?.text}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-[auto,1fr,auto] items-center gap-2">
        <button
          type="button"
          onClick={() => moveToSentence(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="subtle-button flex h-11 w-11 items-center justify-center rounded-xl text-muted transition hover:text-foreground disabled:opacity-40"
          aria-label="Previous sentence"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          type="button"
          onClick={handlePlayPause}
          className="glow-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {speechState === "speaking" ? <Pause size={17} /> : <Play size={17} />}
          {speechState === "speaking"
            ? "Pause sentence"
            : speechState === "paused"
              ? "Resume sentence"
              : "Play sentence"}
        </button>

        <button
          type="button"
          onClick={() => moveToSentence(currentIndex + 1)}
          disabled={currentIndex === sentences.length - 1}
          className="subtle-button flex h-11 w-11 items-center justify-center rounded-xl text-muted transition hover:text-foreground disabled:opacity-40"
          aria-label="Next sentence"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {mode === "shadow" && (
        <div className="mt-4 rounded-2xl border border-border/60 px-4 py-3">
          <p className="text-safe-title text-sm font-medium">Shadowing check</p>
          <p className="text-safe-meta mt-1 text-xs text-muted">
            Play the sentence, repeat it aloud offline, then mark how it felt.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {SHADOW_RATINGS.map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() =>
                  setShadowRatings((current) => ({
                    ...current,
                    [currentIndex]: rating,
                  }))
                }
                className={`min-h-10 rounded-xl px-2 py-2 text-sm font-medium transition ${
                  shadowRatings[currentIndex] === rating
                    ? "glow-button text-primary-foreground"
                    : "subtle-button text-muted hover:text-foreground"
                }`}
              >
                {rating}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "dictation" && (
        <div className="mt-4 rounded-2xl border border-border/60 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-safe-title text-sm font-medium">Dictation</p>
              <p className="text-safe-meta mt-1 text-xs text-muted">
                Play the sentence, type what you heard, then check your score.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDictationAnswer((current) => !current)}
              className="subtle-button inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground"
            >
              <Eye size={15} />
              {showDictationAnswer ? "Hide answer" : "Show answer"}
            </button>
          </div>

          <textarea
            value={dictationText}
            onChange={(event) => {
              setDictationText(event.target.value);
              setDictationResult(null);
            }}
            rows={3}
            placeholder="Type the sentence you heard..."
            className="glass-input mt-3 w-full resize-none rounded-xl px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/40"
          />

          <button
            type="button"
            onClick={handleSubmitDictation}
            disabled={!dictationText.trim()}
            className="glow-button mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            Check dictation
          </button>

          {dictationResult && (
            <div className="mt-3 space-y-3 rounded-xl bg-white/55 px-3 py-3 dark:bg-white/5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="glass-chip rounded-full px-3 py-1 text-sm font-medium text-primary">
                  Score {dictationResult.score}%
                </span>
                {dictationResult.score === 100 && (
                  <span className="text-safe-meta text-xs text-success">Exact enough</span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="editorial-label mb-2">Missing</p>
                  {dictationResult.missing.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {dictationResult.missing.map((word, index) => (
                        <span
                          key={`${word}-${index}`}
                          className="rounded-full bg-warning/10 px-2 py-1 text-xs text-warning"
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-safe-meta text-xs text-muted">No missing words.</p>
                  )}
                </div>

                <div>
                  <p className="editorial-label mb-2">Extra</p>
                  {dictationResult.extra.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {dictationResult.extra.map((word, index) => (
                        <span
                          key={`${word}-${index}`}
                          className="rounded-full bg-danger/10 px-2 py-1 text-xs text-danger"
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-safe-meta text-xs text-muted">No extra words.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-safe-meta text-sm text-muted">Speed</span>
          <div className="grid grid-cols-4 gap-2">
            {SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => setRate(speed)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  rate === speed
                    ? "glow-button text-primary-foreground"
                    : "subtle-button text-muted hover:text-foreground"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRepeatSentence((current) => !current)}
          className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
            repeatSentence
              ? "glow-button text-primary-foreground"
              : "subtle-button text-muted hover:text-foreground"
          }`}
        >
          <Repeat size={15} />
          {repeatSentence ? "Repeating current sentence" : "Repeat sentence off"}
        </button>
      </div>

      {notice && (
        <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">
          {notice}
        </p>
      )}

      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
        {sentences.map((sentence) => (
          <button
            key={sentence.id}
            type="button"
            onClick={() => moveToSentence(sentence.index)}
            className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
              sentence.index === currentIndex
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border/60 bg-white/45 text-muted hover:text-foreground dark:bg-white/5"
            }`}
          >
            <span className="text-safe-meta mr-2 text-xs text-primary">
              {sentence.index + 1}
            </span>
            <span className="text-safe-body">{sentence.text}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
