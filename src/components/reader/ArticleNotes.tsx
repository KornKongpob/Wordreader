"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, StickyNote, Save } from "lucide-react";
import { getUserWithProfile } from "@/lib/supabase/ensureProfile";

interface ArticleNotesProps {
  articleId: string;
}

export default function ArticleNotes({ articleId }: ArticleNotesProps) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadNote = async () => {
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { user } = await getUserWithProfile(supabase);

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("article_notes")
        .select("note")
        .eq("user_id", user.id)
        .eq("article_id", articleId)
        .maybeSingle();

      setNote(data?.note || "");
      setLoading(false);
    };

    void loadNote();
  }, [articleId]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    setError("");

    const supabase = createClient();
    if (!supabase) {
      setSaving(false);
      return;
    }

    const { user, error: userError } = await getUserWithProfile(supabase);

    if (!user || userError) {
      setError(userError || "Please sign in to save notes.");
      setSaving(false);
      return;
    }

    const { error: saveError } = await supabase.from("article_notes").upsert(
      {
        user_id: user.id,
        article_id: articleId,
        note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,article_id" }
    );

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setMessage("Saved");
    setSaving(false);
  };

  return (
    <section className="glass-panel mt-8 rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <StickyNote size={16} className="text-primary" />
        <h2 className="font-medium">Article notes</h2>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" />
          <span>Loading notes...</span>
        </div>
      ) : (
        <>
          {error && (
            <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Write a quick summary, new expression, or your own example sentence."
            className="glass-input min-h-28 w-full rounded-xl px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/40"
          />
          <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-safe-meta text-xs text-muted">
              Your notes sync with this article.
            </p>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              {message && <span className="text-xs text-success">{message}</span>}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="glow-button inline-flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60 sm:w-auto"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save note
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
