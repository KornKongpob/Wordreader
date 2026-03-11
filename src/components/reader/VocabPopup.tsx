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
import type {
  LookupResult,
  ParagraphExplainResult,
  SavedVocabularyPreview,
  SentenceExplainResult,
  SentenceKeyPhrase,
  VocabularyLookupResult,
} from "@/types";

interface VocabPopupProps {
  lookup: LookupRequest;
  articleId: string;
  articleTitle: string;
  articleSourceName: string;
  cacheRef: MutableRefObject<Map<string, LookupResult>>;
  onSaved?: (item: SavedVocabularyPreview) => void;
  onClose: () => void;
}

function isSameText(a: string, b: string) {
  return normalizeLookupText(a).toLowerCase() === normalizeLookupText(b).toLowerCase();
}

function truncateText(value: string, limit = 180) {
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function getSheetLabel(result: LookupRequest) {
  if (result.mode === "paragraph") {
    return result.intent === "explain" ? "Paragraph Coach" : "Paragraph Translation";
  }

  if (result.mode === "sentence") {
    return result.intent === "explain" ? "Sentence Coach" : "Sentence Translation";
  }

  return "Word Spotlight";
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
            paragraph: activeLookup.paragraph,
            articleTitle,
            mode: activeLookup.mode,
            intent: activeLookup.intent,
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
      onSaved?.({
        id: vocabItemId,
        word: normalizedWord,
        thai_meaning: result.thai_meaning,
        english_meaning: result.english_meaning,
        part_of_speech: result.part_of_speech,
        difficulty: result.difficulty,
        pronunciation: normalizedWord,
        last_source_name: articleSourceName,
      });
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
      paragraph: activeLookup.paragraph,
      mode: "vocab",
      intent: "translate",
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

  const renderPhraseList = (keyPhrases: SentenceKeyPhrase[]) => {
    if (keyPhrases.length === 0) {
      return <p className="text-sm text-muted">No standout phrases in this selection.</p>;
    }

    return (
      <div className="space-y-2">
        {keyPhrases.map((item) => (
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
    );
  };

  const renderSentenceExplain = (translation: SentenceExplainResult) => (
    <div className="space-y-3">
      <div className="glass-panel rounded-xl p-3">
        <p className="mb-1 text-xs text-muted">Thai translation</p>
        <p className="text-base font-medium leading-relaxed">{translation.thai_translation}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="glass-panel rounded-xl p-3">
          <p className="mb-1 text-xs text-muted">Gist</p>
          <p className="text-sm">{translation.gist}</p>
        </div>
        <div className="glass-panel rounded-xl p-3">
          <p className="mb-1 text-xs text-muted">Structure note</p>
          <p className="text-sm">{translation.structure_note}</p>
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
        {renderPhraseList(translation.key_phrases)}
      </div>
    </div>
  );

  const renderParagraphExplain = (translation: ParagraphExplainResult) => (
    <div className="space-y-3">
      <div className="glass-panel rounded-xl p-3">
        <p className="mb-1 text-xs text-muted">Thai translation</p>
        <p className="text-base font-medium leading-relaxed">{translation.thai_translation}</p>
      </div>

      <div className="glass-panel rounded-xl p-3">
        <p className="mb-1 text-xs text-muted">Gist</p>
        <p className="text-sm">{translation.gist}</p>
      </div>

      <div className="glass-panel rounded-xl p-3">
        <p className="mb-2 text-xs text-muted">Key points</p>
        <div className="space-y-2">
          {translation.key_points.map((point) => (
            <div
              key={point}
              className="glass-chip rounded-xl px-3 py-2 text-sm text-muted"
            >
              {point}
            </div>
          ))}
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
        {renderPhraseList(translation.key_phrases)}
      </div>
    </div>
  );

  const renderResult = () => {
    if (!result) return null;

    if (result.type === "vocab") {
      return renderVocabularyResult(result);
    }

    if (result.type === "sentence" && result.intent === "translate") {
      return (
        <div className="space-y-3">
          <div className="glass-panel rounded-xl p-3">
            <p className="mb-1 text-xs text-muted">Thai translation</p>
            <p className="text-base font-medium leading-relaxed">{result.thai_translation}</p>
          </div>
          <div className="glass-panel rounded-xl p-3">
            <p className="mb-1 text-xs text-muted">Gist</p>
            <p className="text-sm">{result.gist}</p>
          </div>
        </div>
      );
    }

    if (result.type === "sentence" && result.intent === "explain") {
      return renderSentenceExplain(result);
    }

    if (result.type === "paragraph" && result.intent === "translate") {
      return (
        <div className="space-y-3">
          <div className="glass-panel rounded-xl p-3">
            <p className="mb-1 text-xs text-muted">Thai translation</p>
            <p className="text-base font-medium leading-relaxed">{result.thai_translation}</p>
          </div>
          <div className="glass-panel rounded-xl p-3">
            <p className="mb-1 text-xs text-muted">Gist</p>
            <p className="text-sm">{result.gist}</p>
          </div>
        </div>
      );
    }

    return renderParagraphExplain(result);
  };

  const showContextAudio =
    activeLookup.mode === "vocab"
      ? !isSameText(activeLookup.text, activeLookup.sentence)
      : !isSameText(activeLookup.text, activeLookup.paragraph);

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
              <p className="editorial-label mb-2">{getSheetLabel(activeLookup)}</p>
              <h3 className="text-base font-bold leading-snug">
                {truncateText(activeLookup.text, activeLookup.mode === "paragraph" ? 220 : 120)}
              </h3>
              <p className="mt-1 line-clamp-4 text-sm text-muted">
                &ldquo;...
                {truncateText(
                  activeLookup.mode === "paragraph"
                    ? activeLookup.paragraph
                    : activeLookup.sentence
                )}
                &rdquo;
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SpeakButton
                  text={activeLookup.text}
                  label={
                    activeLookup.mode === "vocab" ? "Selection audio" : "Read selection"
                  }
                />
                {showContextAudio && (
                  <SpeakButton
                    text={
                      activeLookup.mode === "paragraph"
                        ? activeLookup.paragraph
                        : activeLookup.sentence
                    }
                    label="Context audio"
                  />
                )}
              </div>
            </div>

            <button
              type="button"
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
                {activeLookup.intent === "explain" ? "Preparing explanation..." : "Translating..."}
              </span>
            </div>
          )}

          {!loading && renderResult()}

          {error && (
            <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {!loading && !result && !error && (
            <div className="glass-panel flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm text-muted">
              <Sparkles size={16} />
              Nothing came back for this selection. Try another selection.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
