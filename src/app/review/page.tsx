"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateNextReview } from "@/lib/srs";
import AppShell from "@/components/layout/AppShell";
import Flashcard from "@/components/review/Flashcard";
import { getOfflineReviewDeck, saveOfflineReviewDeck } from "@/lib/offline";
import { Flame, Loader2, PartyPopper, RotateCcw, Target } from "lucide-react";
import Link from "next/link";

interface ReviewCard {
  vocabulary_item_id: string;
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  example_sentence: string;
  contextual_meaning: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  review_state_id: string;
}

interface ReviewStateRow {
  id: string;
  vocabulary_item_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
}

interface ReviewDayRow {
  reviewed_at: string;
}

interface ReviewVocabularyRow {
  id: string;
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
}

interface ReviewContextRow {
  vocabulary_item_id: string;
  original_sentence: string;
  contextual_meaning: string;
  created_at: string;
}

function getStartOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function calculateStreak(reviewedAt: string[]) {
  const uniqueDays = [...new Set(reviewedAt.map((value) => value.slice(0, 10)))].sort(
    (a, b) => b.localeCompare(a)
  );

  if (uniqueDays.length === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (const day of uniqueDays) {
    const expected = cursor.toISOString().slice(0, 10);
    if (day !== expected) {
      if (streak === 0) {
        cursor.setDate(cursor.getDate() - 1);
        if (day !== cursor.toISOString().slice(0, 10)) {
          break;
        }
      } else {
        break;
      }
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export default function ReviewPage() {
  const supabase = createClient();
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [reviewGoal, setReviewGoal] = useState(10);
  const [reviewedToday, setReviewedToday] = useState(0);
  const [streak, setStreak] = useState(0);
  const [offlineSession, setOfflineSession] = useState(false);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchReviewData = async () => {
      if (!supabase) {
        const cachedDeck = getOfflineReviewDeck().cards;
        setCards(cachedDeck as ReviewCard[]);
        setOfflineSession(cachedDeck.length > 0);
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
      userIdRef.current = user.id;

      const startOfToday = getStartOfToday().toISOString();

      const [{ data: settings }, { count: reviewedCount }, { data: reviewDays }, { data: reviewStates }] =
        await Promise.all([
          supabase
            .from("user_settings")
            .select("review_goal")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("review_events")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("reviewed_at", startOfToday),
          supabase
            .from("review_events")
            .select("reviewed_at")
            .eq("user_id", user.id)
            .order("reviewed_at", { ascending: false })
            .limit(45),
          supabase
            .from("review_states")
            .select("id, vocabulary_item_id, ease_factor, interval_days, repetitions, next_review_at")
            .eq("user_id", user.id)
            .lte("next_review_at", new Date().toISOString())
            .order("next_review_at", { ascending: true })
            .limit(30),
        ]);

      setReviewGoal(settings?.review_goal ?? 10);
      setReviewedToday(reviewedCount ?? 0);
      setStreak(
        calculateStreak(
          (reviewDays ?? []).map((entry: ReviewDayRow) => entry.reviewed_at)
        )
      );

      if (!reviewStates || reviewStates.length === 0) {
        setCards([]);
        setLoading(false);
        return;
      }

      const typedReviewStates = reviewStates as ReviewStateRow[];
      const vocabularyIds = typedReviewStates.map((item) => item.vocabulary_item_id);

      const [{ data: vocabItems }, { data: contexts }] = await Promise.all([
        supabase
          .from("vocabulary_items")
          .select("id, word, thai_meaning, english_meaning, part_of_speech")
          .in("id", vocabularyIds),
        supabase
          .from("vocabulary_contexts")
          .select("vocabulary_item_id, original_sentence, contextual_meaning, created_at")
          .in("vocabulary_item_id", vocabularyIds)
          .order("created_at", { ascending: false }),
      ]);

      const vocabMap = new Map(
        ((vocabItems ?? []) as ReviewVocabularyRow[]).map((item) => [item.id, item])
      );
      const contextMap = new Map<string, { original_sentence: string; contextual_meaning: string }>();

      for (const context of (contexts ?? []) as ReviewContextRow[]) {
        if (!contextMap.has(context.vocabulary_item_id)) {
          contextMap.set(context.vocabulary_item_id, {
            original_sentence: context.original_sentence || "",
            contextual_meaning: context.contextual_meaning || "",
          });
        }
      }

      const reviewCards: ReviewCard[] = typedReviewStates.flatMap((reviewState) => {
        const vocabItem = vocabMap.get(reviewState.vocabulary_item_id);
        if (!vocabItem) return [];

        const context = contextMap.get(reviewState.vocabulary_item_id);

        return [
          {
            vocabulary_item_id: reviewState.vocabulary_item_id,
            word: vocabItem.word,
            thai_meaning: vocabItem.thai_meaning,
            english_meaning: vocabItem.english_meaning,
            part_of_speech: vocabItem.part_of_speech,
            example_sentence: context?.original_sentence || "",
            contextual_meaning: context?.contextual_meaning || "",
            ease_factor: reviewState.ease_factor,
            interval_days: reviewState.interval_days,
            repetitions: reviewState.repetitions,
            review_state_id: reviewState.id,
          },
        ];
      });

      setCards(reviewCards);
      saveOfflineReviewDeck(reviewCards);
      setLoading(false);
    };

    void fetchReviewData();
  }, [supabase]);

  const handleRate = async (rating: "again" | "easy" | "medium" | "hard") => {
    const card = cards[currentIndex];
    if (!card) return;

    setReviewedToday((current) => current + 1);
    setSessionReviewed((current) => current + 1);

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setFinished(true);
    }

    const userId = userIdRef.current;
    if (!supabase || !userId) return;

    const update = calculateNextReview(
      {
        ease_factor: card.ease_factor,
        interval_days: card.interval_days,
        repetitions: card.repetitions,
      },
      rating
    );

    void Promise.all([
      supabase
        .from("review_states")
        .update({
          ease_factor: update.ease_factor,
          interval_days: update.interval_days,
          repetitions: update.repetitions,
          next_review_at: update.next_review_at,
          last_reviewed_at: new Date().toISOString(),
        })
        .eq("id", card.review_state_id),
      supabase.from("review_events").insert({
        user_id: userId,
        vocabulary_item_id: card.vocabulary_item_id,
        rating,
      }),
    ]);
  };

  const goalProgress = useMemo(
    () => Math.min(100, Math.round((reviewedToday / reviewGoal) * 100)),
    [reviewGoal, reviewedToday]
  );

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted" />
        </div>
      </AppShell>
    );
  }

  if (cards.length === 0) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg px-5 py-6">
          <h1 className="mb-2 text-xl font-bold">Review Flashcards</h1>
          <div className="glass-panel mb-6 rounded-2xl p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-primary">
              <Target size={16} />
              <span>Daily goal</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>{reviewedToday}/{reviewGoal} reviewed today</span>
              <span>{streak} day streak</span>
              </div>
            </div>

          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="glass-chip mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-primary">
              <RotateCcw size={32} className="text-primary" />
            </div>
            <p className="font-medium mb-1">No words due right now</p>
            <p className="text-safe-body mb-4 text-sm text-muted">
              {offlineSession
                ? "Your offline deck is empty. Open more words while online to cache a practice set."
                : "Save words from articles and they&apos;ll show up here when it&apos;s time to review."}
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                href="/read"
                className="glow-button rounded-xl px-4 py-2 text-center text-sm font-medium text-primary-foreground"
              >
                Read an article
              </Link>
              <Link
                href="/vocabulary"
                className="subtle-button rounded-xl px-4 py-2 text-center text-sm font-medium"
              >
                Organize words
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (finished) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg px-5 py-6">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="glass-chip mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-success">
              <PartyPopper size={32} className="text-success" />
            </div>
            <p className="mb-1 text-xl font-bold">Session complete</p>
            <p className="mb-6 text-sm text-muted">
              You reviewed {sessionReviewed} card{sessionReviewed !== 1 ? "s" : ""} this session and reached {reviewedToday}/{reviewGoal} for today.
            </p>
            <div className="glass-panel mb-6 rounded-2xl p-4 text-left">
              <div className="mb-2 flex items-center gap-2 text-sm text-primary">
                <Flame size={16} />
                <span>Momentum</span>
              </div>
              <p className="text-sm text-muted">{streak} day streak active</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                href="/"
                className="subtle-button rounded-xl px-4 py-2 text-center text-sm font-medium"
              >
                Home
              </Link>
              <Link
                href="/read"
                className="glow-button rounded-xl px-4 py-2 text-center text-sm font-medium text-primary-foreground"
              >
                Read more
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const card = cards[currentIndex];

  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-5 py-6">
        <div className="glass-hero mb-6 rounded-[2rem] p-5">
          <p className="editorial-label mb-2">Review Studio</p>
          <h1 className="text-xl font-bold">Review Flashcards</h1>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div className="glass-panel rounded-2xl px-3 py-3">
              <p className="editorial-label">Due now</p>
              <p className="mt-2 text-lg font-semibold">{cards.length - currentIndex}</p>
            </div>
            <div className="glass-panel rounded-2xl px-3 py-3">
              <p className="editorial-label">Today</p>
              <p className="mt-2 text-lg font-semibold">{reviewedToday}/{reviewGoal}</p>
            </div>
            <div className="glass-panel rounded-2xl px-3 py-3">
              <p className="editorial-label">Streak</p>
              <p className="mt-2 text-lg font-semibold">{streak}d</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          {offlineSession && (
            <p className="text-safe-body mt-3 text-xs text-muted">
              Working from your cached deck. Ratings move this session forward, but only online sessions sync your schedule.
            </p>
          )}
        </div>

        <Flashcard
          key={card.vocabulary_item_id}
          word={card.word}
          thai_meaning={card.thai_meaning}
          english_meaning={card.english_meaning}
          part_of_speech={card.part_of_speech}
          example_sentence={card.example_sentence}
          contextual_meaning={card.contextual_meaning}
          onRate={handleRate}
          current={currentIndex + 1}
          total={cards.length}
        />
      </div>
    </AppShell>
  );
}
