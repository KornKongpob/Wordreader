"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateLocalDayStreak, getStartOfLocalToday } from "@/lib/local-date";
import {
  prepareReviewSyncPayload,
  type PreparedReviewSyncPayload,
} from "@/lib/review-sync";
import type { ReviewRating } from "@/lib/srs";
import AppShell from "@/components/layout/AppShell";
import ClozeReview from "@/components/review/ClozeReview";
import Flashcard from "@/components/review/Flashcard";
import ListeningReview from "@/components/review/ListeningReview";
import ReviewModeSelector from "@/components/review/ReviewModeSelector";
import TypingReview from "@/components/review/TypingReview";
import type { ReviewMode } from "@/components/review/types";
import { getOfflineReviewDeck, saveOfflineReviewDeck } from "@/lib/offline";
import { AlertCircle, Flame, Loader2, PartyPopper, RotateCcw, Target } from "lucide-react";
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
  vocabulary_items:
    | {
        id: string;
        word: string;
        thai_meaning: string;
        english_meaning: string;
        part_of_speech: string;
        vocabulary_contexts?: ReviewContextRow[] | null;
      }
    | {
        id: string;
        word: string;
        thai_meaning: string;
        english_meaning: string;
        part_of_speech: string;
        vocabulary_contexts?: ReviewContextRow[] | null;
      }[]
    | null;
}

interface ReviewContextRow {
  original_sentence: string;
  contextual_meaning: string;
  created_at: string;
}

interface ReviewDayRow {
  reviewed_at: string;
}

interface FailedReviewSync extends PreparedReviewSyncPayload {
  id: string;
  word: string;
  errorMessage: string;
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
  const [, setReviewedAtHistory] = useState<string[]>([]);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [syncError, setSyncError] = useState("");
  const [failedSyncs, setFailedSyncs] = useState<FailedReviewSync[]>([]);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("flashcard");
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchReviewData = async () => {
      if (!supabase) {
        const cachedDeck = getOfflineReviewDeck().cards;
        setCards(cachedDeck as ReviewCard[]);
        setOfflineSession(cachedDeck.length > 0);
        if (cachedDeck.length > 0) {
          setSyncNotice(
            "Offline cached review is available. Ratings move this session forward only and do not sync your schedule yet."
          );
        }
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

      const startOfToday = getStartOfLocalToday().toISOString();

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
            .select(
              "id, vocabulary_item_id, ease_factor, interval_days, repetitions, next_review_at, vocabulary_items!inner(id, word, thai_meaning, english_meaning, part_of_speech, vocabulary_contexts(original_sentence, contextual_meaning, created_at))"
            )
            .eq("user_id", user.id)
            .lte("next_review_at", new Date().toISOString())
            .order("next_review_at", { ascending: true })
            .limit(30),
        ]);

      setReviewGoal(settings?.review_goal ?? 10);
      setReviewedToday(reviewedCount ?? 0);
      const reviewHistory = (reviewDays ?? []).map(
        (entry: ReviewDayRow) => entry.reviewed_at
      );
      setReviewedAtHistory(reviewHistory);
      setStreak(calculateLocalDayStreak(reviewHistory));

      if (!reviewStates || reviewStates.length === 0) {
        setCards([]);
        setLoading(false);
        return;
      }

      const reviewCards: ReviewCard[] = (reviewStates as ReviewStateRow[]).flatMap((reviewState) => {
        const vocabItem = Array.isArray(reviewState.vocabulary_items)
          ? reviewState.vocabulary_items[0]
          : reviewState.vocabulary_items;
        if (!vocabItem) return [];

        const latestContext = [...(vocabItem.vocabulary_contexts ?? [])]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        return [
          {
            vocabulary_item_id: reviewState.vocabulary_item_id,
            word: vocabItem.word,
            thai_meaning: vocabItem.thai_meaning,
            english_meaning: vocabItem.english_meaning,
            part_of_speech: vocabItem.part_of_speech,
            example_sentence: latestContext?.original_sentence || "",
            contextual_meaning: latestContext?.contextual_meaning || "",
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

  const applyLocalReviewProgress = (reviewedAt: string) => {
    setReviewedToday((current) => current + 1);
    setSessionReviewed((current) => current + 1);
    setReviewedAtHistory((current) => {
      const next = [reviewedAt, ...current];
      setStreak(calculateLocalDayStreak(next));
      return next;
    });

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setFinished(true);
    }
  };

  const getReviewSyncErrorMessage = (error: unknown) => {
    return error instanceof Error ? error.message : "Review sync failed.";
  };

  const syncPreparedReview = async (payload: PreparedReviewSyncPayload) => {
    if (!supabase) {
      throw new Error("Supabase is unavailable.");
    }

    const { error: stateError } = await supabase
      .from("review_states")
      .update(payload.reviewStateUpdate)
      .eq("id", payload.reviewStateId)
      .select("id")
      .single();

    if (stateError) {
      throw stateError;
    }

    const { error: eventError } = await supabase
      .from("review_events")
      .insert(payload.reviewEventInsert)
      .select("id")
      .single();

    if (eventError && eventError.code !== "23505") {
      throw eventError;
    }
  };

  const queueFailedSync = (
    payload: PreparedReviewSyncPayload,
    card: ReviewCard,
    error: unknown
  ) => {
    const failedSync: FailedReviewSync = {
      ...payload,
      id: `${card.vocabulary_item_id}-${payload.reviewedAt}`,
      word: card.word,
      errorMessage: getReviewSyncErrorMessage(error),
    };

    setFailedSyncs((current) => [
      failedSync,
      ...current.filter((item) => item.id !== failedSync.id),
    ]);
    setSyncError(
      `Could not sync "${card.word}". Your session moved forward, but its schedule and review event still need syncing.`
    );
  };

  const retryFailedSync = async (failedSync: FailedReviewSync) => {
    if (ratingBusy) return;

    setRatingBusy(true);
    setSyncError("");
    setSyncNotice("Syncing pending review...");

    try {
      await syncPreparedReview(failedSync);
      setFailedSyncs((current) => current.filter((item) => item.id !== failedSync.id));
      setSyncNotice(`Synced "${failedSync.word}".`);
    } catch (error) {
      setFailedSyncs((current) =>
        current.map((item) =>
          item.id === failedSync.id
            ? { ...item, errorMessage: getReviewSyncErrorMessage(error) }
            : item
        )
      );
      setSyncError(`Still could not sync "${failedSync.word}". Please try again.`);
    } finally {
      setRatingBusy(false);
    }
  };

  const handleRate = async (rating: ReviewRating) => {
    if (ratingBusy) return;

    const card = cards[currentIndex];
    if (!card) return;

    setRatingBusy(true);
    setSyncError("");
    setSyncNotice("");
    const userId = userIdRef.current;
    const reviewedAt = new Date().toISOString();

    if (!supabase || !userId) {
      applyLocalReviewProgress(reviewedAt);
      setOfflineSession(true);
      setSyncNotice(
        "Offline cached review moved locally. This does not sync your review schedule yet."
      );
      setRatingBusy(false);
      return;
    }

    const payload = prepareReviewSyncPayload({
      card,
      rating,
      userId,
      reviewedAt,
    });

    applyLocalReviewProgress(payload.reviewedAt);

    try {
      await syncPreparedReview(payload);
      setSyncNotice("Review synced.");
    } catch (error) {
      queueFailedSync(payload, card, error);
    } finally {
      setRatingBusy(false);
    }
  };

  const goalProgress = useMemo(
    () => Math.min(100, Math.round((reviewedToday / reviewGoal) * 100)),
    [reviewGoal, reviewedToday]
  );

  const syncStatusPanel =
    syncError || syncNotice || failedSyncs.length > 0 ? (
      <div className="glass-panel mb-4 space-y-3 rounded-[1.4rem] px-4 py-3">
        {syncError && (
          <div className="flex items-start gap-2 text-sm text-danger">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="text-safe-body">{syncError}</p>
          </div>
        )}
        {!syncError && syncNotice && (
          <div className="flex items-start gap-2 text-sm text-muted">
            {ratingBusy ? (
              <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />
            ) : (
              <RotateCcw size={16} className="mt-0.5 shrink-0" />
            )}
            <p className="text-safe-body">{syncNotice}</p>
          </div>
        )}
        {failedSyncs.length > 0 && (
          <div className="space-y-2">
            <p className="editorial-label">Pending Sync</p>
            {failedSyncs.map((failedSync) => (
              <div
                key={failedSync.id}
                className="glass-chip flex flex-col gap-2 rounded-xl px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-safe-title text-sm font-medium">{failedSync.word}</p>
                  <p className="text-safe-meta text-xs text-muted">
                    {failedSync.errorMessage}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void retryFailedSync(failedSync)}
                  disabled={ratingBusy}
                  className="subtle-button inline-flex min-h-[2.25rem] items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium disabled:cursor-wait disabled:opacity-60"
                >
                  {ratingBusy ? <Loader2 size={12} className="animate-spin" /> : null}
                  Retry
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    ) : null;

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
          <h1 className="mb-2 text-xl font-bold">Review Practice</h1>
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
            {syncStatusPanel}
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
  const reviewPracticeProps = {
    word: card.word,
    thai_meaning: card.thai_meaning,
    english_meaning: card.english_meaning,
    part_of_speech: card.part_of_speech,
    example_sentence: card.example_sentence,
    contextual_meaning: card.contextual_meaning,
    onRate: handleRate,
    current: currentIndex + 1,
    total: cards.length,
    ratingBusy,
    ratingStatus: ratingBusy ? "Syncing..." : "",
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-5 py-6">
        <div className="glass-hero mb-6 rounded-[2rem] p-5">
          <p className="editorial-label mb-2">Review Studio</p>
          <h1 className="text-xl font-bold">Review Practice</h1>
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
              Working from your cached deck. Ratings move this session forward, but they do not sync review events or schedule changes yet.
            </p>
          )}
          <ReviewModeSelector
            selectedMode={reviewMode}
            onChange={setReviewMode}
            disabled={ratingBusy}
          />
        </div>

        {syncStatusPanel}

        {reviewMode === "flashcard" && (
          <Flashcard
            key={`flashcard-${card.vocabulary_item_id}`}
            {...reviewPracticeProps}
          />
        )}
        {reviewMode === "typing" && (
          <TypingReview
            key={`typing-${card.vocabulary_item_id}`}
            {...reviewPracticeProps}
          />
        )}
        {reviewMode === "cloze" && (
          <ClozeReview
            key={`cloze-${card.vocabulary_item_id}`}
            {...reviewPracticeProps}
          />
        )}
        {reviewMode === "listening" && (
          <ListeningReview
            key={`listening-${card.vocabulary_item_id}`}
            {...reviewPracticeProps}
          />
        )}
      </div>
    </AppShell>
  );
}
