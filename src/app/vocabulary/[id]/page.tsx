"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import AppShell from "@/components/layout/AppShell";
import SpeakButton from "@/components/common/SpeakButton";
import { createClient } from "@/lib/supabase/client";
import { normalizeVocabularyEnrichment } from "@/lib/vocabulary-enrichment";
import type {
  VocabularyCefrLevel,
  VocabularyCollocationItem,
  VocabularyWordFamilyItem,
} from "@/types";

interface VocabDetail {
  id: string;
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  difficulty: "easy" | "medium" | "hard";
  lemma?: string;
  cefr_level?: VocabularyCefrLevel;
  synonyms?: string[];
  antonyms?: string[];
  word_family?: VocabularyWordFamilyItem[];
  collocations?: VocabularyCollocationItem[];
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
  article:
    | {
        id: string;
        title: string;
        url: string;
        source_name: string;
      }
    | {
        id: string;
        title: string;
        url: string;
        source_name: string;
      }[]
    | null;
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
        .select(
          "id, original_sentence, contextual_meaning, context_explanation, created_at, article:articles(id, title, url, source_name)"
        )
        .eq("vocabulary_item_id", id)
        .order("created_at", { ascending: false });

      if (contextData) {
        setContexts(contextData as VocabContext[]);
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
    if (!item) return;

    const supabase = createClient();
    if (!supabase) return;

    setSaving(true);

    const nextTags = tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const updatedAt = new Date().toISOString();

    await supabase
      .from("vocabulary_items")
      .update({
        folder_name: folderName.trim() || "General",
        tags: nextTags,
        notes,
        starred,
        updated_at: updatedAt,
      })
      .eq("id", id);

    setItem({
      ...item,
      folder_name: folderName.trim() || "General",
      tags: nextTags,
      notes,
      starred,
      updated_at: updatedAt,
    });

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this word and all its contexts?")) return;
    setDeleting(true);

    const supabase = createClient();
    if (!supabase) {
      setDeleting(false);
      return;
    }

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
        <div className="mx-auto max-w-lg px-5 py-6">
          <div className="glass-panel rounded-[1.75rem] px-5 py-10 text-center">
            <p className="text-muted">Word not found.</p>
            <Link
              href="/vocabulary"
              className="glass-chip mt-4 inline-flex rounded-full px-3 py-1.5 text-sm text-primary"
            >
              Back to vocabulary
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const dueNow = reviewState ? new Date(reviewState.next_review_at) <= new Date() : false;
  const enrichment = normalizeVocabularyEnrichment(item);
  const showLemma =
    enrichment.lemma.length > 0 && enrichment.lemma.toLowerCase() !== item.word.toLowerCase();
  const hasEnrichment =
    showLemma ||
    enrichment.cefr_level.length > 0 ||
    enrichment.collocations.length > 0 ||
    enrichment.synonyms.length > 0 ||
    enrichment.antonyms.length > 0 ||
    enrichment.word_family.length > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-5 py-6 space-y-5">
        <Link
          href="/vocabulary"
          className="glass-chip inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back
        </Link>

        <section className="glass-hero rounded-[2rem] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="editorial-label mb-2">Vocabulary Spotlight</p>
              <div className="mb-2 flex flex-wrap items-start gap-2">
                <h1 className="text-safe-title line-clamp-3 text-3xl font-semibold tracking-[-0.03em]">
                  {item.word}
                </h1>
                {starred && <Star size={16} className="fill-warning text-warning" />}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.part_of_speech && (
                  <span className="glass-chip rounded-full px-3 py-1 text-sm italic text-muted">
                    {item.part_of_speech}
                  </span>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${difficultyColor[item.difficulty]}`}
                >
                  {item.difficulty}
                </span>
                {enrichment.cefr_level && (
                  <span className="glass-chip rounded-full px-3 py-1 text-xs font-medium text-primary">
                    {enrichment.cefr_level}
                  </span>
                )}
                {showLemma && (
                  <span className="glass-chip max-w-full rounded-full px-3 py-1 text-xs text-muted">
                    <span className="chip-truncate">lemma: {enrichment.lemma}</span>
                  </span>
                )}
                {dueNow && (
                  <span className="glass-chip rounded-full px-3 py-1 text-xs font-medium text-primary">
                    Due now
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="subtle-button rounded-full p-2 text-muted transition hover:text-danger disabled:opacity-60"
              aria-label="Delete vocabulary item"
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
              <span className="glass-chip max-w-full rounded-full px-3 py-1.5 text-xs text-muted">
                <span className="chip-truncate">{item.last_source_name}</span>
              </span>
            )}
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="glass-panel rounded-[1.75rem] p-4">
            <p className="editorial-label mb-2">Thai Meaning</p>
            <p className="text-safe-title text-lg font-medium">{item.thai_meaning}</p>
          </div>

          <div className="glass-panel rounded-[1.75rem] p-4">
            <p className="editorial-label mb-2">English Meaning</p>
            <p className="text-safe-body text-sm">{item.english_meaning}</p>
          </div>
        </div>

        {hasEnrichment && (
          <section className="glass-panel rounded-[1.75rem] p-4">
            <p className="editorial-label mb-1">Learning Notes</p>
            <h2 className="mb-3 font-medium">Extra ways to remember this word</h2>

            {(showLemma || enrichment.cefr_level) && (
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                {showLemma && (
                  <div className="glass-chip rounded-[1.2rem] px-3 py-3">
                    <p className="editorial-label">Lemma</p>
                    <p className="mt-2 text-sm font-medium">{enrichment.lemma}</p>
                  </div>
                )}
                {enrichment.cefr_level && (
                  <div className="glass-chip rounded-[1.2rem] px-3 py-3">
                    <p className="editorial-label">CEFR Level</p>
                    <p className="mt-2 text-sm font-medium">{enrichment.cefr_level}</p>
                  </div>
                )}
              </div>
            )}

            {enrichment.collocations.length > 0 && (
              <div className="mb-4">
                <p className="editorial-label mb-2">Collocations</p>
                <div className="space-y-2">
                  {enrichment.collocations.map((collocation) => (
                    <div
                      key={`${collocation.phrase}-${collocation.thai_meaning}`}
                      className="glass-chip rounded-[1.15rem] px-3 py-2"
                    >
                      <p className="text-safe-title text-sm font-medium">
                        {collocation.phrase}
                      </p>
                      {collocation.thai_meaning && (
                        <p className="text-safe-body mt-1 text-sm text-muted">
                          {collocation.thai_meaning}
                        </p>
                      )}
                      {collocation.example && (
                        <p className="text-safe-meta mt-1 text-xs text-muted">
                          {collocation.example}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(enrichment.synonyms.length > 0 || enrichment.antonyms.length > 0) && (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                {enrichment.synonyms.length > 0 && (
                  <div>
                    <p className="editorial-label mb-2">Synonyms</p>
                    <div className="flex flex-wrap gap-2">
                      {enrichment.synonyms.map((synonym) => (
                        <span
                          key={synonym}
                          className="glass-chip rounded-full px-3 py-1 text-xs text-muted"
                        >
                          {synonym}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {enrichment.antonyms.length > 0 && (
                  <div>
                    <p className="editorial-label mb-2">Antonyms</p>
                    <div className="flex flex-wrap gap-2">
                      {enrichment.antonyms.map((antonym) => (
                        <span
                          key={antonym}
                          className="glass-chip rounded-full px-3 py-1 text-xs text-muted"
                        >
                          {antonym}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {enrichment.word_family.length > 0 && (
              <div>
                <p className="editorial-label mb-2">Word Family</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {enrichment.word_family.map((familyItem) => (
                    <div
                      key={`${familyItem.word}-${familyItem.part_of_speech}`}
                      className="glass-chip rounded-[1.15rem] px-3 py-2"
                    >
                      <p className="text-safe-title text-sm font-medium">{familyItem.word}</p>
                      <p className="text-safe-meta mt-1 text-xs text-muted">
                        {[familyItem.part_of_speech, familyItem.thai_meaning]
                          .filter(Boolean)
                          .join(" / ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="glass-panel rounded-[1.75rem] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Bookmark size={16} className="text-primary" />
            <div>
              <p className="editorial-label mb-1">Organization</p>
              <h2 className="font-medium">Keep this word easy to find</h2>
            </div>
          </div>

          <div className="space-y-3">
            <div className="glass-chip flex flex-col gap-3 rounded-[1.35rem] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <FolderOpen size={16} className="mt-0.5 text-muted" />
                <div className="min-w-0">
                  <p className="text-safe-title text-sm font-medium">Favorite this word</p>
                  <p className="text-safe-meta text-xs text-muted">
                    Keep important words easy to find.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStarred((current) => !current)}
                className={`w-full rounded-full px-3 py-1.5 text-xs font-medium transition sm:w-auto ${
                  starred
                    ? "glow-button text-primary-foreground"
                    : "subtle-button text-muted hover:text-foreground"
                }`}
              >
                {starred ? "Starred" : "Star"}
              </button>
            </div>

            <label className="block">
              <span className="editorial-label mb-2 block">Folder</span>
              <input
                type="text"
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                placeholder="General"
                className="glass-input w-full rounded-[1.2rem] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
              />
            </label>

            <label className="block">
              <span className="editorial-label mb-2 block">Tags</span>
              <input
                type="text"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="news, health, business"
                className="glass-input w-full rounded-[1.2rem] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
              />
            </label>

            <label className="block">
              <span className="editorial-label mb-2 block">Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Write your own example sentence or memory trick."
                className="glass-input min-h-28 w-full rounded-[1.2rem] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"
              />
            </label>

            <button
              type="button"
              onClick={() => void handleSaveDetails()}
              disabled={saving}
              className="glow-button inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save changes
            </button>
          </div>
        </section>

        {reviewState && (
          <section className="glass-panel rounded-[1.75rem] p-4">
            <p className="editorial-label mb-1">Review Status</p>
            <h2 className="mb-3 font-medium">When this word comes back</h2>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="glass-chip rounded-[1.2rem] px-3 py-3">
                <p className="editorial-label">Next Review</p>
                <p className="mt-2 font-medium">
                  {dueNow
                    ? "Due now"
                    : new Date(reviewState.next_review_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                </p>
              </div>
              <div className="glass-chip rounded-[1.2rem] px-3 py-3">
                <p className="editorial-label">Repetitions</p>
                <p className="mt-2 font-medium">{reviewState.repetitions}</p>
              </div>
              <div className="glass-chip rounded-[1.2rem] px-3 py-3">
                <p className="editorial-label">Interval</p>
                <p className="mt-2 font-medium">{reviewState.interval_days} day(s)</p>
              </div>
            </div>

            {reviewEvents.length > 0 && (
              <div className="mt-4">
                <p className="editorial-label mb-2">Recent Ratings</p>
                <div className="space-y-2">
                  {reviewEvents.map((event) => (
                    <div
                      key={`${event.reviewed_at}-${event.rating}`}
                      className="glass-chip flex items-center justify-between rounded-[1.15rem] px-3 py-2 text-sm"
                    >
                      <span className="text-safe-title font-medium capitalize">{event.rating}</span>
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
          <section>
            <h2 className="editorial-label mb-3">Contexts ({contexts.length})</h2>
            <div className="space-y-3">
              {contexts.map((context) => {
                const article = Array.isArray(context.article)
                  ? context.article[0]
                  : context.article;

                return (
                  <div
                    key={context.id}
                    className="glass-panel space-y-3 rounded-[1.75rem] p-4"
                  >
                    <p className="text-safe-body text-sm italic">
                      &ldquo;{context.original_sentence}&rdquo;
                    </p>
                    {context.contextual_meaning && (
                      <p className="text-sm text-muted">
                        <strong className="text-foreground">Meaning here:</strong>{" "}
                        {context.contextual_meaning}
                      </p>
                    )}
                    {context.context_explanation && (
                      <p className="text-safe-meta text-xs text-muted">
                        {context.context_explanation}
                      </p>
                    )}
                    {article && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Link
                          href={`/read/${article.id}`}
                          className="glass-chip max-w-full rounded-full px-3 py-1.5 text-xs text-primary transition hover:text-foreground sm:max-w-[70%]"
                        >
                          <span className="chip-truncate">{article.title}</span>
                        </Link>
                        <span className="glass-chip rounded-full px-3 py-1.5 text-xs text-muted">
                          {article.source_name}
                        </span>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glass-chip rounded-full px-2 py-2 text-muted transition hover:text-primary"
                          aria-label="Open original article"
                        >
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="glass-chip inline-flex flex-col gap-1 rounded-[1.2rem] px-4 py-3 text-xs text-muted">
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
