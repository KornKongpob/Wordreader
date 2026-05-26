interface ReviewProgressProps {
  current: number;
  total: number;
}

export default function ReviewProgress({ current, total }: ReviewProgressProps) {
  return (
    <div className="flex w-full items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/10">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
      <span className="shrink-0 text-xs text-muted">
        {current}/{total}
      </span>
    </div>
  );
}
