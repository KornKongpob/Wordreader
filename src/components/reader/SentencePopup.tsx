"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import { BookText, Loader2, Sparkles, X } from "lucide-react";
import SpeakButton from "@/components/common/SpeakButton";
import { normalizeLookupText } from "@/lib/lookup";
import type { SentenceAnalysisResult } from "@/types";

interface SentencePopupSelection {
  text: string;
  sentence: string;
  paragraph: string;
}

interface SentencePopupProps {
  selection: SentencePopupSelection;
  articleId: string;
  articleTitle: string;
  cacheRef: MutableRefObject<Map<string, SentenceAnalysisResult>>;
  onClose: () => void;
}

function createCacheKey(articleId: string, sentence: string) {
  return [articleId, normalizeLookupText(sentence).toLowerCase()].join("::");
}

function isSameText(a: string, b: string) {
  return normalizeLookupText(a).toLowerCase() === normalizeLookupText(b).toLowerCase();
}

export default function SentencePopup({
  selection,
  articleId,
  articleTitle,
  cacheRef,
  onClose,
}: SentencePopupProps) {
  const [result, setResult] = useState<SentenceAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    const loadAnalysis = async () => {
      setLoading(true);
      setError(null);
      setResult(null);

      const cacheKey = createCacheKey(articleId, selection.sentence);
      const cachedResult = cacheRef.current.get(cacheKey);
      if (cachedResult) {
        setResult(cachedResult);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/analyze-sentence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            sentence: selection.sentence,
            paragraph: selection.paragraph,
            articleTitle,
          }),
        });

        const data = (await response.json()) as SentenceAnalysisResult | { error?: string };

        if (!response.ok) {
          if (!isCancelled) {
            setError("error" in data ? data.error || "Sentence analysis failed." : "Sentence analysis failed.");
            setLoading(false);
          }
          return;
        }

        if (isCancelled) return;

        cacheRef.current.set(cacheKey, data as SentenceAnalysisResult);
        setResult(data as SentenceAnalysisResult);
      } catch (fetchError) {
        if (controller.signal.aborted || isCancelled) {
          return;
        }

        console.error("Sentence analysis request failed:", fetchError);
        setError("Network error. Please try again.");
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void loadAnalysis();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [articleId, articleTitle, cacheRef, selection.paragraph, selection.sentence]);

  const showContextAudio = !isSameText(selection.sentence, selection.paragraph);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-slate-950/28 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="glass-panel-strong fixed bottom-0 left-0 right-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[2rem] pb-safe animate-slide-up">
        <div className="mx-auto max-w-lg px-5 pb-6 pt-4">
          <div className="mb-3 flex justify-center">
            <div className="h-1 w-10 rounded-full bg-primary/20" />
          </div>

          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="editorial-label mb-2">Sentence Breakdown</p>
              <h3 className="text-safe-title line-clamp-4 text-base font-bold">
                {selection.sentence}
              </h3>
              {!isSameText(selection.text, selection.sentence) && (
                <p className="text-safe-meta mt-2 text-xs text-muted">
                  Selected text: {selection.text}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <SpeakButton text={selection.sentence} label="Read sentence" />
                {showContextAudio && (
                  <SpeakButton text={selection.paragraph} label="Read paragraph" />
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="subtle-button -mr-1 rounded-xl p-1.5 text-muted transition hover:text-foreground"
              aria-label="Close sentence analysis"
            >
              <X size={20} />
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Breaking down the sentence...</span>
            </div>
          )}

          {!loading && result && (
            <div className="space-y-3">
              <div className="glass-panel rounded-xl p-4">
                <p className="mb-1 text-xs text-muted">Thai translation</p>
                <p className="text-safe-body text-base font-medium">{result.translation}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                <div className="glass-panel rounded-xl px-4 py-3">
                  <p className="mb-1 text-xs text-muted">Main tense</p>
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                    <BookText size={14} />
                    {result.tense}
                  </div>
                </div>

                <div className="glass-panel rounded-xl p-4">
                  <p className="mb-2 text-xs text-muted">Grammar explanation</p>
                  <p className="text-safe-body text-sm leading-6">{result.explanation}</p>
                </div>
              </div>

              <div className="glass-panel rounded-xl p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted">Sentence structure</p>
                    <p className="text-safe-meta text-xs text-muted">
                      Read it chunk by chunk from top to bottom.
                    </p>
                  </div>
                  <span className="glass-chip rounded-full px-3 py-1 text-xs text-muted">
                    {result.structure.length} parts
                  </span>
                </div>

                <div className="space-y-2">
                  {result.structure.map((item, index) => (
                    <div
                      key={`${item.part}-${item.text}-${index}`}
                      className="rounded-2xl border border-primary/10 bg-primary/5 px-3 py-3"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {index + 1}
                        </span>
                        <span className="text-sm font-semibold text-primary">{item.part}</span>
                      </div>
                      <p className="text-safe-body text-sm leading-6">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {!loading && !result && !error && (
            <div className="glass-panel flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm text-muted">
              <Sparkles size={16} />
              Nothing came back for this sentence. Try again in a moment.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
