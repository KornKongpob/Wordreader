// SM-2 Spaced Repetition Algorithm
// Based on SuperMemo 2, simplified for our use case
// Rating: "again" repeats later today, "hard" resets, "medium"/"easy" advance

interface ReviewState {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
}

interface ReviewUpdate extends ReviewState {
  next_review_at: string;
}

type Rating = "again" | "easy" | "medium" | "hard";

const RATING_SCORES: Record<Rating, number> = {
  again: 1,
  hard: 0,
  medium: 3,
  easy: 5,
};

export function calculateNextReview(
  current: ReviewState,
  rating: Rating
): ReviewUpdate {
  const score = RATING_SCORES[rating];
  let { ease_factor, interval_days, repetitions } = current;

  if (rating === "again") {
    ease_factor = Math.max(1.3, ease_factor - 0.2);
    const nextDate = new Date();
    nextDate.setHours(nextDate.getHours() + 4);

    return {
      ease_factor: Math.round(ease_factor * 100) / 100,
      interval_days: 0,
      repetitions,
      next_review_at: nextDate.toISOString(),
    };
  }

  if (score < 3) {
    // Failed — reset to beginning
    repetitions = 0;
    interval_days = 1;
  } else {
    // Passed
    if (repetitions === 0) {
      interval_days = 1;
    } else if (repetitions === 1) {
      interval_days = 3;
    } else {
      interval_days = Math.round(interval_days * ease_factor);
    }
    repetitions += 1;
  }

  // Update ease factor (minimum 1.3)
  ease_factor = Math.max(
    1.3,
    ease_factor + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02))
  );

  // Cap interval at 365 days
  interval_days = Math.min(interval_days, 365);

  // Calculate next review date
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval_days);

  return {
    ease_factor: Math.round(ease_factor * 100) / 100,
    interval_days,
    repetitions,
    next_review_at: nextDate.toISOString(),
  };
}
