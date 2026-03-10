"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Loader2, BookmarkPlus, Check, Languages } from "lucide-react";
import SpeakButton from "@/components/common/SpeakButton";
import { getUserWithProfile } from "@/lib/supabase/ensureProfile";

interface VocabPopupProps {
  word: string;
  sentence: string;
  articleId: string;
  articleTitle: string;
  articleSourceName: string;
  onSaved?: (word: string) => void;
  onClose: () => void;
}

interface TranslationData {
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  contextual_meaning: string;
  context_explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

export default function VocabPopup({
  word,
  sentence,
  articleId,
  articleTitle,
  articleSourceName,
  onSaved,
  onClose,
}: VocabPopupProps) {
  const [translation, setTranslation] = useState<TranslationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, sentence, articleTitle }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Translation failed.");
        setLoading(false);
        return;
      }

      setTranslation(data);
    } catch {
      setError("Network error. Please try again.");
    }

    setLoading(false);
  };

  const handleSave = async () => {
    if (!translation) return;
    setSaving(true);
    setError(null);

    try {
      const normalizedWord = word.trim();
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
            thai_meaning: translation.thai_meaning,
            english_meaning: translation.english_meaning,
            part_of_speech: translation.part_of_speech,
            difficulty: translation.difficulty,
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
            thai_meaning: translation.thai_meaning,
            english_meaning: translation.english_meaning,
            part_of_speech: translation.part_of_speech,
            difficulty: translation.difficulty,
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
        original_sentence: sentence,
        contextual_meaning: translation.contextual_meaning,
        context_explanation: translation.context_explanation,
      });

      if (contextError) {
        setError(contextError.message);
        setSaving(false);
        return;
      }

      setSaved(true);
      onSaved?.(normalizedWord);
    } catch {
      setError("Could not save. Please try again.");
    }

    setSaving(false);
  };

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

          <div className="mb-4 flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="editorial-label mb-2">Word Spotlight</p>
              <h3 className="truncate text-lg font-bold">{word}</h3>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                &ldquo;...
                {sentence.length > 120 ? sentence.slice(0, 120) + "..." : sentence}
                &rdquo;
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SpeakButton text={word} label="Word audio" />
                <SpeakButton text={sentence} label="Sentence audio" />
              </div>
            </div>
            <button
              onClick={onClose}
              className="subtle-button -mr-1 rounded-xl p-1.5 text-muted transition hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          {!translation && !loading && (
            <button
              onClick={handleTranslate}
              className="glow-button flex w-full items-center justify-center gap-2 rounded-xl py-3 font-medium text-primary-foreground transition active:scale-[0.98]"
            >
              <Languages size={18} />
              Translate & Explain
            </button>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-muted">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Translating...</span>
            </div>
          )}

          {translation && (
            <div className="space-y-3">
              <div className="glass-panel rounded-xl p-3">
                <p className="mb-1 text-xs text-muted">Thai</p>
                <p className="text-lg font-medium">{translation.thai_meaning}</p>
              </div>

              <div className="glass-panel rounded-xl p-3">
                <p className="mb-1 text-xs text-muted">
                  English ({translation.part_of_speech})
                </p>
                <p className="text-sm">{translation.english_meaning}</p>
              </div>

              <div className="glass-panel rounded-xl p-3">
                <p className="mb-1 text-xs text-muted">In this context</p>
                <p className="text-sm">{translation.contextual_meaning}</p>
                <p className="mt-2 text-xs text-muted">
                  {translation.context_explanation}
                </p>
              </div>

              <div className="glass-chip rounded-xl px-3 py-2 text-xs text-muted">
                Source:{" "}
                <span className="font-medium text-foreground">{articleSourceName}</span>
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
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
