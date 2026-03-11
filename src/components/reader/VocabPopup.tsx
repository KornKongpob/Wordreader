"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import { BookmarkPlus, Check, Loader2, Sparkles, X } from "lucide-react";
import SpeakButton from "@/components/common/SpeakButton";
import { createClient } from "@/lib/supabase/client";
import {
  createLookupCacheKey,
  normalizeLookupText,
  type LookupRequest,
} from "@/lib/lookup";
import { getUserWithProfile } from "@/lib/supabase/ensureProfile";
import type { LookupResult, SentenceKeyPhrase, VocabularyLookupResult } from "@/types";

interface VocabPopupProps {
  lookup: LookupRequest;
  articleId: string;
  articleTitle: string;
  articleSourceName: string;
  cacheRef: MutableRefObject<Map<string, LookupResult>>;
  onSaved?: (word: string) => void;
  onClose: () => void;
}

function isSameText(a: string, b: string) {
  return normalizeLookupText(a).toLowerCase() === normalizeLookupText(b).toLowerCase();
}

function truncateSentence(value: string) {
  return value.length > 140 ? `${value.slice(0, 140)}...` : value;
}

export default function VocabPopup({
  lookup,
  articleId,
  articleTitle,
  articleSourceName,
  cacheRef,
  onSaved,
  onClose,
}: VocabPopupProps) {
  const [activeLookup, setActiveLookup] = useState<LookupRequest>(lookup);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActiveLookup(lookup);
    setSaved(false);
    setError(null);
  }, [lookup]);

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    const loadLookup = async () => {
      setLoading(true);
      setError(null);
      setResult(null);

      const cacheKey = createLookupCacheKey(articleId, activeLookup);
      const cachedResult = cacheRef.current.get(cacheKey);
      if (cachedResult) {
        setResult(cachedResult);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            text: activeLookup.text,
            sentence: activeLookup.sentence,
            articleTitle,
            mode: activeLookup.mode,
          }),
        });

        const data = (await response.json()) as LookupResult | { error?: string };

        if (!response.ok) {
          if (!isCancelled) {
            setError("error" in data ? data.error || "Translation failed." : "Translation failed.");
            setLoading(false);
          }
          return;
        }

        if (isCancelled) return;

        cacheRef.current.set(cacheKey, data as LookupResult);
        setResult(data as LookupResult);
      } catch (fetchError) {
        if (controller.signal.aborted || isCancelled) {
          return;
        }

        console.error("Lookup request failed:", fetchError);
        setError("Network error. Please try again.");
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void loadLookup();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [activeLookup, articleId, articleTitle, cacheRef]);

  const handleSave = async () => {
    if (!result || result.type !== "vocab") return;

    setSaving(true);
    setError(null);

    try {
      const normalizedWord = result.text.trim();
      const supabase = createClient();
      if (!supabase) {
        setError("Supabase is not configured.");
        setSaving(false);
        return;
      }

      const { user, error: userError } = await getUserWithProfile(supabase);

      if (!user || userError) {
        setError(userError || "Please sign in to save vocabulary.");
        setSaving(false);
        return;
      }

      const { data: existingItem, error: existingItemError } = await supabase
        .from("vocabulary_items")
        .select("id")
        .eq("user_id", user.id)
        .ilike("word", normalizedWord)
        .maybeSingle();

      if (existingItemError) {
        setError(existingItemError.message);
        setSaving(false);
        return;
      }

      let vocabItemId: string;

      if (existingItem) {
        vocabItemId = existingItem.id;

        const { error: updateError } = await supabase
          .from("vocabulary_items")
          .update({
            thai_meaning: result.thai_meaning,
            english_meaning: result.english_meaning,
            part_of_speech: result.part_of_speech,
            difficulty: result.difficulty,
            last_source_name: articleSourceName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", vocabItemId);

        if (updateError) {
          setError(updateError.message);
          setSaving(false);
          return;
        }
      } else {
        const { data: newItem, error: insertError } = await supabase
          .from("vocabulary_items")
          .insert({
            user_id: user.id,
            word: normalizedWord,
            thai_meaning: result.thai_meaning,
            english_meaning: result.english_meaning,
            part_of_speech: result.part_of_speech,
            difficulty: result.difficulty,
            pronunciation: normalizedWord,
            last_source_name: articleSourceName,
          })
          .select("id")
          .single();

        if (insertError || !newItem) {
          setError("Could not save word. Please try again.");
          setSaving(false);
          return;
        }

        vocabItemId = newItem.id;

        const { error: reviewStateError } = await supabase.from("review_states").upsert(
          {
            user_id: user.id,
            vocabulary_item_id: vocabItemId,
          },
          { onConflict: "user_id,vocabulary_item_id" }
        );

        if (reviewStateError) {
          setError(reviewStateError.message);
          setSaving(false);
          return;
        }
      }

      const { error: contextError } = await supabase.from("vocabulary_contexts").insert({
        vocabulary_item_id: vocabItemId,
        article_id: articleId,
        original_sentence: activeLookup.sentence,
        contextual_meaning: result.contextual_meaning,
        context_explanation: result.context_explanation,
      });

      if (contextError) {
        setError(contextError.message);
        setSaving(false);
        return;
      }

      setSaved(true);
      onSaved?.(normalizedWord);
    } catch (saveError) {
      console.error("Save vocabulary failed:", saveError);
      setError("Could not save. Please try again.");
    }

    setSaving(false);
  };

  const handlePhraseLookup = (phrase: SentenceKeyPhrase["phrase"]) => {
    setSaved(false);
    setActiveLookup({
      text: phrase,
      sentence: activeLookup.sentence,
      mode: "vocab",
    });
  };

  const renderVocabularyResult = (translation: VocabularyLookupResult) => (
    <div className="space-y-3">
      <div className="glass-panel rounded-xl p-3">
        <p className="mb-1 text-xs text-muted">Thai</p>
        <p className="text-lg font-medium">{translation.thai_meaning}</p>
      </div>

      <div className="glass-panel rounded-xl p-3">
        <p className="mb-1 text-xs text-muted">English ({translation.part_of_speech})</p>
        <p className="text-sm">{translation.english_meaning}</p>
      </div>

      <div className="glass-panel rounded-xl p-3">
        <p className="mb-1 text-xs text-muted">In this context</p>
        <p className="text-sm">{translation.contextual_meaning}</p>
        <p className="mt-2 text-xs text-muted">{translation.context_explanation}</p>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            translation.difficulty === "easy"
              ? "bg-success/15 text-success"
              : translation.difficulty === "medium"
                ? "bg-warning/15 text-warning"
                : "bg-danger/15 text-danger"
          }`}
        >
          {translation.difficulty}
        </span>
        <span className="glass-chip rounded-full px-3 py-1 text-xs text-muted">
          Source: <span className="font-medium text-foreground">{articleSourceName}</span>
        </span>
      </div>

      {!saved ? (
        <button
          onClick={handleSave}
          disabled={saving}
          className="glow-button flex w-full items-center justify-center gap-2 rounded-xl py-3 font-medium text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <BookmarkPlus size={18} />
          )}
          {saving ? "Saving..." : "Save to Vocabulary"}
        </button>
      ) : (
        <div className="glass-chip flex w-full items-center justify-center gap-2 rounded-xl py-3 font-medium text-success">
          <Check size={18} />
          Saved!
        </div>
      )}
    </div>
  );

  const renderSentenceResult = (translation: Extract<LookupResult, { type: "sentence" }>) => (
    <div className="space-y-3">
      <div className="glass-panel rounded-xl p-3">
        <p className="mb-1 text-xs text-muted">Thai translation</p>
        <p className="text-base font-medium leading-relaxed">{translation.thai_translation}</p>
      </div>

      <div className="glass-panel rounded-xl p-3">
        <p className="mb-1 text-xs text-muted">Simple English</p>
        <p className="text-sm">{translation.simple_english}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="glass-panel rounded-xl p-3">
          <p className="mb-1 text-xs text-muted">Grammar note</p>
          <p className="text-sm">{translation.grammar_note}</p>
        </div>

        <div className="glass-panel rounded-xl p-3">
          <p className="mb-1 text-xs text-muted">Usage note</p>
          <p className="text-sm">{translation.usage_note}</p>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted">Key phrases</p>
            <p className="text-xs text-muted">Tap a phrase to inspect it like vocabulary.</p>
          </div>
          <span className="glass-chip rounded-full px-3 py-1 text-xs text-muted">
            {articleSourceName}
          </span>
        </div>

        {translation.key_phrases.length === 0 ? (
          <p className="text-sm text-muted">No standout phrases in this sentence.</p>
        ) : (
          <div className="space-y-2">
            {translation.key_phrases.map((item) => (
              <button
                key={`${item.phrase}-${item.thai_meaning}`}
                type="button"
                onClick={() => handlePhraseLookup(item.phrase)}
                className="glass-chip flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:text-foreground"
              >
                <div>
                  <p className="font-medium">{item.phrase}</p>
                  <p className="mt-1 text-sm text-muted">{item.explanation}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {item.thai_meaning}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const isSentenceSelection = activeLookup.mode === "sentence";
  const showContextAudio = !isSameText(activeLookup.text, activeLookup.sentence);

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
              <p className="editorial-label mb-2">
                {isSentenceSelection ? "Sentence Coach" : "Word Spotlight"}
              </p>
              <h3
                className={`font-bold ${
                  isSentenceSelection ? "text-base leading-snug" : "truncate text-lg"
                }`}
              >
                {activeLookup.text}
              </h3>
              <p className="mt-1 line-clamp-3 text-sm text-muted">
                &ldquo;...{truncateSentence(activeLookup.sentence)}&rdquo;
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SpeakButton
                  text={activeLookup.text}
                  label={isSentenceSelection ? "Sentence audio" : "Selection audio"}
                />
                {showContextAudio && (
                  <SpeakButton text={activeLookup.sentence} label="Context audio" />
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="subtle-button -mr-1 rounded-xl p-1.5 text-muted transition hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">
                {isSentenceSelection ? "Building your sentence coach..." : "Looking this up..."}
              </span>
            </div>
          )}

          {!loading && result?.type === "vocab" && renderVocabularyResult(result)}
          {!loading && result?.type === "sentence" && renderSentenceResult(result)}

          {error && (
            <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {!loading && !result && !error && (
            <div className="glass-panel flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm text-muted">
              <Sparkles size={16} />
              Nothing came back for this selection. Try another sentence.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
