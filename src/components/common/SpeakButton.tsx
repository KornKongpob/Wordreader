"use client";

import { Volume2 } from "lucide-react";

interface SpeakButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export default function SpeakButton({
  text,
  label = "Listen",
  className = "",
}: SpeakButtonProps) {
  const handleSpeak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      type="button"
      onClick={handleSpeak}
      className={`glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground ${className}`}
    >
      <Volume2 size={14} />
      <span>{label}</span>
    </button>
  );
}
