"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/layout/AppShell";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  BookOpen,
  ExternalLink,
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

export default function VocabularyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [item, setItem] = useState<VocabDetail | null>(null);
  const [contexts, setContexts] = useState<VocabContext[]>([]);
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      // Fetch vocabulary item
      const { data: vocabData } = await supabase
        .from("vocabulary_items")
        .select("*")
        .eq("id", id)
        .single();

      if (!vocabData) {
        setLoading(false);
        return;
      }

      setItem(vocabData as VocabDetail);

      // Fetch contexts with article info
      const { data: contextData } = await supabase
        .from("vocabulary_contexts")
        .select("id, original_sentence, contextual_meaning, context_explanation, created_at, article_id")
        .eq("vocabulary_item_id", id)
        .order("created_at", { ascending: false });

      if (contextData) {
        // Fetch article info for each context
        const contextWithArticles = await Promise.all(
          contextData.map(async (ctx) => {
            const { data: articleData } = await supabase
              .from("articles")
              .select("id, title, url, source_name")
              .eq("id", ctx.article_id)
              .single();

            return {
              ...ctx,
              article: articleData,
            } as VocabContext;
          })
        );
        setContexts(contextWithArticles);
      }

      // Fetch review state
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: reviewData } = await supabase
          .from("review_states")
          .select("next_review_at, interval_days, repetitions")
          .eq("user_id", user.id)
          .eq("vocabulary_item_id", id)
          .single();

        if (reviewData) {
          setReviewState(reviewData as ReviewState);
        }
      }

      setLoading(false);
    };

    fetchDetail();
  }, [id]);

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
        <div className="px-5 py-6 max-w-lg mx-auto text-center">
          <p className="text-muted">Word not found.</p>
          <Link href="/vocabulary" className="text-primary text-sm mt-2 inline-block">
            Back to vocabulary
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-5 py-6 max-w-lg mx-auto">
        {/* Back button */}
        <Link
          href="/vocabulary"
          className="inline-flex items-center gap-1 text-muted hover:text-foreground text-sm mb-4 transition"
        >
          <ArrowLeft size={16} />
          Back
        </Link>

        {/* Word header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{item.word}</h1>
              <div className="flex items-center gap-2 mt-1">
                {item.part_of_speech && (
                  <span className="text-sm text-muted italic">
                    {item.part_of_speech}
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyColor[item.difficulty]}`}
                >
                  {item.difficulty}
                </span>
              </div>
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 text-muted hover:text-danger transition"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Meanings */}
        <div className="space-y-3 mb-6">
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-xs text-muted mb-1 uppercase tracking-wide">
              Thai
            </p>
            <p className="text-lg">{item.thai_meaning}</p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-xs text-muted mb-1 uppercase tracking-wide">
              English
            </p>
            <p className="text-sm">{item.english_meaning}</p>
          </div>
        </div>

        {/* Review status */}
        {reviewState && (
          <div className="p-4 rounded-xl bg-card border border-border mb-6">
            <p className="text-xs text-muted mb-2 uppercase tracking-wide">
              Review Status
            </p>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted">Next review:</span>{" "}
                <span className="font-medium">
                  {new Date(reviewState.next_review_at) <= new Date()
                    ? "Due now"
                    : new Date(reviewState.next_review_at).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" }
                      )}
                </span>
              </div>
              <div>
                <span className="text-muted">Reviews:</span>{" "}
                <span className="font-medium">{reviewState.repetitions}</span>
              </div>
            </div>
          </div>
        )}

        {/* Contexts */}
        {contexts.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wide">
              Contexts ({contexts.length})
            </h2>
            <div className="space-y-3">
              {contexts.map((ctx) => (
                <div
                  key={ctx.id}
                  className="p-4 rounded-xl bg-card border border-border space-y-2"
                >
                  <p className="text-sm italic leading-relaxed">
                    &ldquo;{ctx.original_sentence}&rdquo;
                  </p>
                  {ctx.contextual_meaning && (
                    <p className="text-sm text-muted">
                      <strong className="text-foreground">Meaning here:</strong>{" "}
                      {ctx.contextual_meaning}
                    </p>
                  )}
                  {ctx.context_explanation && (
                    <p className="text-xs text-muted">
                      {ctx.context_explanation}
                    </p>
                  )}
                  {ctx.article && (
                    <div className="flex items-center gap-1 pt-1">
                      <BookOpen size={12} className="text-muted" />
                      <Link
                        href={`/read/${ctx.article.id}`}
                        className="text-xs text-primary hover:underline truncate"
                      >
                        {ctx.article.title}
                      </Link>
                      <a
                        href={ctx.article.url}
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
          </div>
        )}

        {/* Metadata */}
        <div className="text-xs text-muted space-y-1">
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
