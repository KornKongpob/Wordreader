"use client";

import { Pause, Play, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SpeakButtonProps {
  text: string;
  label?: string;
  className?: string;
}

type SpeechState = "idle" | "speaking" | "paused";

function pickPreferredVoice(voices: SpeechSynthesisVoice[]) {
  const englishVoices = voices.filter((voice) => /^en(-|_)/i.test(voice.lang));
  const preferenceOrder = [
    /natural/i,
    /aria/i,
    /jenny/i,
    /guy/i,
    /samantha/i,
    /zira/i,
    /google us english/i,
    /microsoft/i,
  ];

  for (const pattern of preferenceOrder) {
    const preferred = englishVoices.find((voice) => pattern.test(voice.name));
    if (preferred) {
      return preferred;
    }
  }

  return englishVoices[0] ?? voices[0] ?? null;
}

export default function SpeakButton({
  text,
  label = "Listen",
  className = "",
}: SpeakButtonProps) {
  const [speechState, setSpeechState] = useState<SpeechState>("idle");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const normalizedText = text.trim();

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const synth = window.speechSynthesis;
    const updateVoices = () => {
      setVoices(synth.getVoices());
    };

    updateVoices();
    synth.addEventListener("voiceschanged", updateVoices);

    return () => {
      synth.removeEventListener("voiceschanged", updateVoices);
      if (utteranceRef.current) {
        synth.cancel();
        utteranceRef.current = null;
      }
    };
  }, []);

  const handleSpeak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !normalizedText) {
      return;
    }

    const synth = window.speechSynthesis;

    if (speechState === "speaking" && synth.speaking && !synth.paused) {
      synth.pause();
      setSpeechState("paused");
      return;
    }

    if (speechState === "paused" && synth.paused) {
      synth.resume();
      setSpeechState("speaking");
      return;
    }

    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(normalizedText);
    const voice = pickPreferredVoice(voices);

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "en-US";
    }

    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeechState("speaking");
    utterance.onpause = () => setSpeechState("paused");
    utterance.onresume = () => setSpeechState("speaking");
    utterance.onend = () => {
      setSpeechState("idle");
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setSpeechState("idle");
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    synth.speak(utterance);
  };

  const Icon = speechState === "speaking" ? Pause : speechState === "paused" ? Play : Volume2;

  return (
    <button
      type="button"
      onClick={handleSpeak}
      className={`glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground ${className}`}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}
