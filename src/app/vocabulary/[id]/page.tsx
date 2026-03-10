"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/layout/AppShell";
import SpeakButton from "@/components/common/SpeakButton";
import {
  ArrowLeft,
  Bookmark,
  ExternalLink,
  FolderOpen,
  Loader2,
  Save,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";

interface VocabDetail {
  id: string;
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  difficulty: "easy" | "medium" | "hard";
  created_at: string;
  updated_at: string;
  tags?: string[];
  folder_name?: string;
  starred?: boolean;
  notes?: string;
  pronunciation?: string;
  last_source_name?: string;
}

interface VocabContext {
  id: string;
  original_sentence: string;
  contextual_meaning: string;
  context_explanation: string;
  created_at: string;
  article: {
    id: string;
    title: string;
    url: string;
    source_name: string;
  } | null;
}

interface ReviewState {
  next_review_at: string;
  interval_days: number;
  repetitions: number;
}

interface ReviewEventItem {
  rating: "again" | "easy" | "medium" | "hard";
  reviewed_at: string;
}

export default function VocabularyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [item, setItem] = useState<VocabDetail | null>(null);
  const [contexts, setContexts] = useState<VocabContext[]>([]);
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [reviewEvents, setReviewEvents] = useState<ReviewEventItem[]>([]);
  const [folderName, setFolderName] = useState("General");
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");
  const [starred, setStarred] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: vocabData } = await supabase
        .from("vocabulary_items")
        .select("*")
        .eq("id", id)
        .single();

      if (!vocabData) {
        setLoading(false);
        return;
      }

      const nextItem = vocabData as VocabDetail;
      setItem(nextItem);
      setFolderName(nextItem.folder_name || "General");
      setTagInput((nextItem.tags || []).join(", "));
      setNotes(nextItem.notes || "");
      setStarred(Boolean(nextItem.starred));

      const { data: contextData } = await supabase
        .from("vocabulary_contexts")
        .select("id, original_sentence, contextual_meaning, context_explanation, created_at, article_id")
        .eq("vocabulary_item_id", id)
        .order("created_at", { ascending: false });

      if (contextData) {
        const contextWithArticles = await Promise.all(
          contextData.map(async (contextRow) => {
            const { data: articleData } = await supabase
              .from("articles")
              .select("id, title, url, source_name")
              .eq("id", contextRow.article_id)
              .single();

            return {
              ...contextRow,
              article: articleData,
            } as VocabContext;
          })
        );
        setContexts(contextWithArticles);
      }

      if (user) {
        const [{ data: reviewData }, { data: reviewEventData }] = await Promise.all([
          supabase
            .from("review_states")
            .select("next_review_at, interval_days, repetitions")
            .eq("user_id", user.id)
            .eq("vocabulary_item_id", id)
            .maybeSingle(),
          supabase
            .from("review_events")
            .select("rating, reviewed_at")
            .eq("user_id", user.id)
            .eq("vocabulary_item_id", id)
            .order("reviewed_at", { ascending: false })
            .limit(8),
        ]);

        if (reviewData) {
          setReviewState(reviewData as ReviewState);
        }
        if (reviewEventData) {
          setReviewEvents(reviewEventData as ReviewEventItem[]);
        }
      }

      setLoading(false);
    };

    void fetchDetail();
  }, [id]);

  const handleSaveDetails = async () => {
    const supabase = createClient();
    if (!supabase || !item) return;

    setSaving(true);

    const nextTags = tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    await supabase
      .from("vocabulary_items")
      .update({
        folder_name: folderName.trim() || "General",
        tags: nextTags,
        notes,
        starred,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    setItem({
      ...item,
      folder_name: folderName.trim() || "General",
      tags: nextTags,
      notes,
      starred,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this word and all its contexts?")) return;
    setDeleting(true);

    const supabase = createClient();
    if (!supabase) return;
    await supabase.from("vocabulary_items").delete().eq("id", id);

    router.push("/vocabulary");
    router.refresh();
  };

  const difficultyColor = {
    easy: "bg-success/15 text-success",
    medium: "bg-warning/15 text-warning",
    hard: "bg-danger/15 text-danger",
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted" />
        </div>
      </AppShell>
    );
  }

  if (!item) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg px-5 py-6 text-center">
          <p className="text-muted">Word not found.</p>
          <Link href="/vocabulary" className="mt-2 inline-block text-sm text-primary">
            Back to vocabulary
          </Link>
        </div>
      </AppShell>
    );
  }

  const dueNow = reviewState ? new Date(reviewState.next_review_at) <= new Date() : false;

  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-5 py-6">
        <Link
          href="/vocabulary"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back
        </Link>

        <div className="mb-6 rounded-[2rem] border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <h1 className="text-2xl font-bold">{item.word}</h1>
                {starred && <Star size={16} className="fill-warning text-warning" />}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.part_of_speech && (
                  <span className="text-sm italic text-muted">{item.part_of_speech}</span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${difficultyColor[item.difficulty]}`}
                >
                  {item.difficulty}
                </span>
                {dueNow && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Due now
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 text-muted transition hover:text-danger"
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SpeakButton text={item.pronunciation || item.word} label="Word audio" />
            {contexts[0]?.original_sentence && (
              <SpeakButton text={contexts[0].original_sentence} label="Latest sentence" />
            )}
            {item.last_source_name && (
              <span className="rounded-full bg-background px-3 py-1 text-xs text-muted">
                {item.last_source_name}
              </span>
            )}
          </div>
        </div>

        <div className="mb-6 space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-1 text-xs uppercase tracking-wide text-muted">Thai</p>
            <p className="text-lg">{item.thai_meaning}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-1 text-xs uppercase tracking-wide text-muted">English</p>
            <p className="text-sm">{item.english_meaning}</p>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Bookmark size={16} className="text-primary" />
            <h2 className="font-medium">Organization</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-background px-3 py-3">
              <div className="flex items-start gap-2">
                <FolderOpen size={16} className="mt-0.5 text-muted" />
                <div>
                  <p className="text-sm font-medium">Favorite this word</p>
                  <p className="text-xs text-muted">Keep important words easy to find.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStarred((current) => !current)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  starred ? "bg-primary text-primary-foreground" : "border border-border text-muted"
                }`}
              >
                {starred ? "Starred" : "Star"}
              </button>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs text-muted">Folder</span>
              <input
                type="text"
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                placeholder="General"
                className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-muted">Tags</span>
              <input
                type="text"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="news, health, business"
                className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-muted">Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Write your own example sentence or memory trick."
                className="min-h-28 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>

            <button
              type="button"
              onClick={() => void handleSaveDetails()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save changes
            </button>
          </div>
        </section>

        {reviewState && (
          <section className="mb-6 rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 font-medium">Review status</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-background px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">Next review</p>
                <p className="mt-2 font-medium">
                  {dueNow
                    ? "Due now"
                    : new Date(reviewState.next_review_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                </p>
              </div>
              <div className="rounded-xl bg-background px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">Repetitions</p>
                <p className="mt-2 font-medium">{reviewState.repetitions}</p>
              </div>
            </div>

            {reviewEvents.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted">Recent ratings</p>
                <div className="space-y-2">
                  {reviewEvents.map((event) => (
                    <div
                      key={`${event.reviewed_at}-${event.rating}`}
                      className="flex items-center justify-between rounded-xl bg-background px-3 py-2 text-sm"
                    >
                      <span className="font-medium capitalize">{event.rating}</span>
                      <span className="text-xs text-muted">
                        {new Date(event.reviewed_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {contexts.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
              Contexts ({contexts.length})
            </h2>
            <div className="space-y-3">
              {contexts.map((context) => (
                <div
                  key={context.id}
                  className="space-y-2 rounded-2xl border border-border bg-card p-4"
                >
                  <p className="text-sm italic leading-relaxed">
                    &ldquo;{context.original_sentence}&rdquo;
                  </p>
                  {context.contextual_meaning && (
                    <p className="text-sm text-muted">
                      <strong className="text-foreground">Meaning here:</strong>{" "}
                      {context.contextual_meaning}
                    </p>
                  )}
                  {context.context_explanation && (
                    <p className="text-xs text-muted">{context.context_explanation}</p>
                  )}
                  {context.article && (
                    <div className="flex items-center gap-1 pt-1">
                      <Link
                        href={`/read/${context.article.id}`}
                        className="truncate text-xs text-primary hover:underline"
                      >
                        {context.article.title}
                      </Link>
                      <a
                        href={context.article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted hover:text-primary"
                      >
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="space-y-1 text-xs text-muted">
          <p>
            Added:{" "}
            {new Date(item.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          {item.updated_at !== item.created_at && (
            <p>
              Updated:{" "}
              {new Date(item.updated_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
