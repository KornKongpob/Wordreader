"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, StickyNote, Save } from "lucide-react";

interface ArticleNotesProps {
  articleId: string;
}

export default function ArticleNotes({ articleId }: ArticleNotesProps) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadNote = async () => {
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

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

    const supabase = createClient();
    if (!supabase) {
      setSaving(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      return;
    }

    await supabase.from("article_notes").upsert(
      {
        user_id: user.id,
        article_id: articleId,
        note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,article_id" }
    );

    setMessage("Saved");
    setSaving(false);
  };

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-4">
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
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Write a quick summary, new expression, or your own example sentence."
            className="min-h-28 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/50"
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted">Your notes sync with this article.</p>
            <div className="flex items-center gap-2">
              {message && <span className="text-xs text-success">{message}</span>}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
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
