"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  X,
  Loader2,
  BookmarkPlus,
  Check,
  Languages,
} from "lucide-react";
import SpeakButton from "@/components/common/SpeakButton";

interface VocabPopupProps {
  word: string;
  sentence: string;
  articleId: string;
  articleTitle: string;
  articleSourceName: string;
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
      const supabase = createClient();
      if (!supabase) {
        setError("Supabase is not configured.");
        setSaving(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please sign in to save vocabulary.");
        setSaving(false);
        return;
      }

      // Check if word already exists for this user
      const { data: existingItem } = await supabase
        .from("vocabulary_items")
        .select("id")
        .eq("user_id", user.id)
        .ilike("word", word.trim())
        .maybeSingle();

      let vocabItemId: string;

      if (existingItem) {
        // Word exists — update meanings if needed and add new context
        vocabItemId = existingItem.id;

        await supabase
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
      } else {
        // Create new vocabulary item
        const { data: newItem, error: insertError } = await supabase
          .from("vocabulary_items")
          .insert({
            user_id: user.id,
            word: word.trim(),
            thai_meaning: translation.thai_meaning,
            english_meaning: translation.english_meaning,
            part_of_speech: translation.part_of_speech,
            difficulty: translation.difficulty,
            pronunciation: word.trim(),
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

        // Also create a review state for spaced repetition
        await supabase.from("review_states").insert({
          user_id: user.id,
          vocabulary_item_id: vocabItemId,
        });
      }

      // Add the context (always, even if word existed — different sentence)
      await supabase.from("vocabulary_contexts").insert({
        vocabulary_item_id: vocabItemId,
        article_id: articleId,
        original_sentence: sentence,
        contextual_meaning: translation.contextual_meaning,
        context_explanation: translation.context_explanation,
      });

      setSaved(true);
    } catch {
      setError("Could not save. Please try again.");
    }

    setSaving(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl border-t border-border shadow-lg max-h-[85dvh] overflow-y-auto pb-safe animate-slide-up">
        <div className="px-5 pt-4 pb-6 max-w-lg mx-auto">
          {/* Handle bar */}
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold truncate">{word}</h3>
              <p className="text-sm text-muted line-clamp-2 mt-0.5">
                &ldquo;...{sentence.length > 120 ? sentence.slice(0, 120) + "..." : sentence}&rdquo;
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SpeakButton text={word} label="Word audio" />
                <SpeakButton text={sentence} label="Sentence audio" />
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 -mr-1 text-muted hover:text-foreground transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* Actions before translation */}
          {!translation && !loading && (
            <button
              onClick={handleTranslate}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <Languages size={18} />
              Translate & Explain
            </button>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-muted">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Translating...</span>
            </div>
          )}

          {/* Translation result */}
          {translation && (
            <div className="space-y-3">
              {/* Thai meaning */}
              <div className="p-3 rounded-xl bg-card border border-border">
                <p className="text-xs text-muted mb-1">Thai</p>
                <p className="text-lg font-medium">
                  {translation.thai_meaning}
                </p>
              </div>

              {/* English meaning */}
              <div className="p-3 rounded-xl bg-card border border-border">
                <p className="text-xs text-muted mb-1">
                  English ({translation.part_of_speech})
                </p>
                <p className="text-sm">{translation.english_meaning}</p>
              </div>

              {/* Contextual meaning */}
              <div className="p-3 rounded-xl bg-card border border-border">
                <p className="text-xs text-muted mb-1">In this context</p>
                <p className="text-sm">{translation.contextual_meaning}</p>
                <p className="text-xs text-muted mt-2">
                  {translation.context_explanation}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted">
                Source: <span className="font-medium text-foreground">{articleSourceName}</span>
              </div>

              {/* Difficulty badge */}
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
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

              {/* Save button */}
              {!saved ? (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <BookmarkPlus size={18} />
                  )}
                  {saving ? "Saving..." : "Save to Vocabulary"}
                </button>
              ) : (
                <div className="w-full py-3 rounded-xl bg-success/15 text-success font-medium flex items-center justify-center gap-2">
                  <Check size={18} />
                  Saved!
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-danger text-sm bg-danger/10 rounded-lg px-3 py-2 mt-3">
              {error}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
