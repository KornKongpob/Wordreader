"use client";

import { useState } from "react";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ChecklistItem {
  label: string;
  done: boolean;
}

interface OnboardingChecklistProps {
  items: ChecklistItem[];
  initiallyDismissed: boolean;
}

export default function OnboardingChecklist({
  items,
  initiallyDismissed,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(initiallyDismissed);

  if (dismissed || items.every((item) => item.done)) {
    return null;
  }

  const handleDismiss = async () => {
    setDismissed(true);
    const supabase = createClient();
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("user_settings").upsert(
      {
        user_id: user.id,
        onboarding_completed: true,
      },
      { onConflict: "user_id" }
    );
  };

  return (
    <section className="mb-6 rounded-3xl border border-primary/20 bg-primary/8 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          <div>
            <h2 className="font-semibold">Get set up in 3 steps</h2>
            <p className="text-sm text-muted">A quick path to your first reading habit.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg p-1 text-muted hover:text-foreground"
          aria-label="Dismiss onboarding"
        >
          <X size={16} />
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm ${
              item.done ? "bg-success/10 text-foreground" : "bg-background/70 text-muted"
            }`}
          >
            <CheckCircle2 size={16} className={item.done ? "text-success" : "text-border"} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
