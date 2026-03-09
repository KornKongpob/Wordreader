"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateNextReview } from "@/lib/srs";
import AppShell from "@/components/layout/AppShell";
import Flashcard from "@/components/review/Flashcard";
import { Loader2, RotateCcw, PartyPopper } from "lucide-react";
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

export default function ReviewPage() {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const fetchDueCards = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Get review states that are due (next_review_at <= now)
      const { data: reviewStates } = await supabase
        .from("review_states")
        .select("id, vocabulary_item_id, ease_factor, interval_days, repetitions, next_review_at")
        .eq("user_id", user.id)
        .lte("next_review_at", new Date().toISOString())
        .order("next_review_at", { ascending: true })
        .limit(20);

      if (!reviewStates || reviewStates.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch vocabulary items and their first context for each review state
      const reviewCards: ReviewCard[] = [];

      for (const rs of reviewStates) {
        const { data: vocabItem } = await supabase
          .from("vocabulary_items")
          .select("word, thai_meaning, english_meaning, part_of_speech")
          .eq("id", rs.vocabulary_item_id)
          .single();

        if (!vocabItem) continue;

        // Get the most recent context for the example sentence
        const { data: context } = await supabase
          .from("vocabulary_contexts")
          .select("original_sentence, contextual_meaning")
          .eq("vocabulary_item_id", rs.vocabulary_item_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        reviewCards.push({
          vocabulary_item_id: rs.vocabulary_item_id,
          word: vocabItem.word,
          thai_meaning: vocabItem.thai_meaning,
          english_meaning: vocabItem.english_meaning,
          part_of_speech: vocabItem.part_of_speech,
          example_sentence: context?.original_sentence || "",
          contextual_meaning: context?.contextual_meaning || "",
          ease_factor: rs.ease_factor,
          interval_days: rs.interval_days,
          repetitions: rs.repetitions,
          review_state_id: rs.id,
        });
      }

      setCards(reviewCards);
      setLoading(false);
    };

    fetchDueCards();
  }, []);

  const handleRate = async (rating: "easy" | "medium" | "hard") => {
    const card = cards[currentIndex];
    if (!card) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Calculate new review state using SM-2
    const update = calculateNextReview(
      {
        ease_factor: card.ease_factor,
        interval_days: card.interval_days,
        repetitions: card.repetitions,
      },
      rating
    );

    // Update review state in Supabase
    await supabase
      .from("review_states")
      .update({
        ease_factor: update.ease_factor,
        interval_days: update.interval_days,
        repetitions: update.repetitions,
        next_review_at: update.next_review_at,
        last_reviewed_at: new Date().toISOString(),
      })
      .eq("id", card.review_state_id);

    // Log the review event
    await supabase.from("review_events").insert({
      user_id: user.id,
      vocabulary_item_id: card.vocabulary_item_id,
      rating,
    });

    // Move to next card
    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setFinished(true);
    }
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

  // No cards due for review
  if (cards.length === 0) {
    return (
      <AppShell>
        <div className="px-5 py-6 max-w-lg mx-auto">
          <h1 className="text-xl font-bold mb-2">Review Flashcards</h1>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <RotateCcw size={32} className="text-primary" />
            </div>
            <p className="font-medium mb-1">No words due for review</p>
            <p className="text-muted text-sm mb-4">
              Save words from articles, and they&apos;ll appear here when
              it&apos;s time to review.
            </p>
            <Link
              href="/read"
              className="text-primary text-sm font-medium hover:underline"
            >
              Read an article
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  // Review complete
  if (finished) {
    return (
      <AppShell>
        <div className="px-5 py-6 max-w-lg mx-auto">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-success/15 flex items-center justify-center mb-4">
              <PartyPopper size={32} className="text-success" />
            </div>
            <p className="text-xl font-bold mb-1">All done!</p>
            <p className="text-muted text-sm mb-6">
              You reviewed {cards.length} word{cards.length !== 1 ? "s" : ""}.
              Come back later for more.
            </p>
            <div className="flex gap-3">
              <Link
                href="/"
                className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-card transition"
              >
                Home
              </Link>
              <Link
                href="/read"
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
              >
                Read More
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // Active review
  const card = cards[currentIndex];

  return (
    <AppShell>
      <div className="px-5 py-6 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-6">Review Flashcards</h1>
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
