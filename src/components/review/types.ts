import type { ReviewRating } from "@/lib/srs";

export type ReviewMode = "flashcard" | "typing" | "cloze" | "listening";

export type ReviewRatingHandler = (rating: ReviewRating) => void | Promise<void>;

export interface ReviewPracticeProps {
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  example_sentence: string;
  contextual_meaning: string;
  onRate: ReviewRatingHandler;
  current: number;
  total: number;
  ratingBusy?: boolean;
  ratingStatus?: string;
}
