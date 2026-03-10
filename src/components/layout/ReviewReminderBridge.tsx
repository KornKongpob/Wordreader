"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ReviewReminderBridge() {
  useEffect(() => {
    const maybeNotify = async () => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      const todayKey = `wordreader-reminder-${new Date().toISOString().slice(0, 10)}`;
      if (localStorage.getItem(todayKey)) return;

      const supabase = createClient();
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: settings } = await supabase
        .from("user_settings")
        .select("enable_notifications, reminder_hour")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!settings?.enable_notifications || Notification.permission !== "granted") {
        return;
      }

      const now = new Date();
      if (
        typeof settings.reminder_hour === "number" &&
        now.getHours() < settings.reminder_hour
      ) {
        return;
      }

      const { count } = await supabase
        .from("review_states")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .lte("next_review_at", new Date().toISOString());

      const dueCount = count ?? 0;
      if (dueCount <= 0) return;

      new Notification("WordReader reminder", {
        body:
          dueCount === 1
            ? "You have 1 word ready to review."
            : `You have ${dueCount} words ready to review.`,
      });
      localStorage.setItem(todayKey, "sent");
    };

    void maybeNotify();
  }, []);

  return null;
}
