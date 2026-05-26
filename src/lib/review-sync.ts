import { calculateNextReview, type ReviewRating } from "@/lib/srs";

interface ReviewSyncCard {
  vocabulary_item_id: string;
  review_state_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
}

interface PrepareReviewSyncPayloadInput {
  card: ReviewSyncCard;
  rating: ReviewRating;
  userId: string;
  reviewedAt?: string;
  reviewEventId?: string;
}

export interface PreparedReviewSyncPayload {
  reviewStateId: string;
  reviewedAt: string;
  reviewStateUpdate: {
    ease_factor: number;
    interval_days: number;
    repetitions: number;
    next_review_at: string;
    last_reviewed_at: string;
  };
  reviewEventInsert: {
    id: string;
    user_id: string;
    vocabulary_item_id: string;
    rating: ReviewRating;
    reviewed_at: string;
  };
}

export function prepareReviewSyncPayload({
  card,
  rating,
  userId,
  reviewedAt = new Date().toISOString(),
  reviewEventId = crypto.randomUUID(),
}: PrepareReviewSyncPayloadInput): PreparedReviewSyncPayload {
  const update = calculateNextReview(
    {
      ease_factor: card.ease_factor,
      interval_days: card.interval_days,
      repetitions: card.repetitions,
    },
    rating
  );

  return {
    reviewStateId: card.review_state_id,
    reviewedAt,
    reviewStateUpdate: {
      ease_factor: update.ease_factor,
      interval_days: update.interval_days,
      repetitions: update.repetitions,
      next_review_at: update.next_review_at,
      last_reviewed_at: reviewedAt,
    },
    reviewEventInsert: {
      id: reviewEventId,
      user_id: userId,
      vocabulary_item_id: card.vocabulary_item_id,
      rating,
      reviewed_at: reviewedAt,
    },
  };
}
