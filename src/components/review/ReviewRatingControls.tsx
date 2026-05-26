import type { ReviewRating } from "@/lib/srs";
import type { ReviewRatingHandler } from "./types";

interface ReviewRatingControlsProps {
  onRate: ReviewRatingHandler;
  ratingBusy?: boolean;
  ratingStatus?: string;
  onBeforeRate?: () => void;
}

const ratingOptions: Array<{
  rating: ReviewRating;
  label: string;
  className: string;
}> = [
  {
    rating: "again",
    label: "Again today",
    className: "subtle-button text-foreground",
  },
  {
    rating: "hard",
    label: "Hard",
    className: "glass-chip text-danger",
  },
  {
    rating: "medium",
    label: "Medium",
    className: "glass-chip text-warning",
  },
  {
    rating: "easy",
    label: "Easy",
    className: "glass-chip text-success",
  },
];

export default function ReviewRatingControls({
  onRate,
  ratingBusy = false,
  ratingStatus = "",
  onBeforeRate,
}: ReviewRatingControlsProps) {
  const handleRate = (rating: ReviewRating) => {
    if (ratingBusy) return;
    onBeforeRate?.();
    void onRate(rating);
  };

  return (
    <div className="w-full space-y-3">
      {ratingStatus && (
        <p className="text-center text-xs font-medium text-muted">{ratingStatus}</p>
      )}
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        {ratingOptions.map((option) => (
          <button
            key={option.rating}
            type="button"
            onClick={() => handleRate(option.rating)}
            disabled={ratingBusy}
            className={`${option.className} flex min-h-[3.25rem] items-center justify-center rounded-xl px-3 py-3 text-center text-sm font-medium transition active:scale-[0.97] disabled:cursor-wait disabled:opacity-60`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
