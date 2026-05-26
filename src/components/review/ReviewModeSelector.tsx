import { BookOpen, FileQuestion, Keyboard, Volume2 } from "lucide-react";
import type { ReviewMode } from "./types";

interface ReviewModeSelectorProps {
  selectedMode: ReviewMode;
  onChange: (mode: ReviewMode) => void;
  disabled?: boolean;
}

const modes: Array<{
  value: ReviewMode;
  label: string;
  description: string;
  Icon: typeof BookOpen;
}> = [
  {
    value: "flashcard",
    label: "Flashcard",
    description: "Reveal meaning",
    Icon: BookOpen,
  },
  {
    value: "typing",
    label: "Typing",
    description: "Recall English",
    Icon: Keyboard,
  },
  {
    value: "cloze",
    label: "Cloze",
    description: "Fill the blank",
    Icon: FileQuestion,
  },
  {
    value: "listening",
    label: "Listening",
    description: "Hear first",
    Icon: Volume2,
  },
];

export default function ReviewModeSelector({
  selectedMode,
  onChange,
  disabled = false,
}: ReviewModeSelectorProps) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {modes.map(({ value, label, description, Icon }) => {
        const selected = selectedMode === value;

        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            disabled={disabled}
            aria-pressed={selected}
            className={`flex min-h-[4rem] items-center gap-2 rounded-2xl px-3 py-2 text-left transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 ${
              selected
                ? "glow-button text-primary-foreground"
                : "glass-chip text-muted hover:text-foreground"
            }`}
          >
            <Icon size={18} className="shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs opacity-80">{description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
