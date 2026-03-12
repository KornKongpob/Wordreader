"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useTheme } from "@/components/layout/ThemeProvider";
import { getStoredLookupStyle, persistLookupStyle } from "@/lib/lookup";
import { createClient } from "@/lib/supabase/client";
import { getOfflineArticles } from "@/lib/offline";
import { useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  Cloud,
  LogOut,
  Minus,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Sun,
  User,
} from "lucide-react";
import type { ReaderLookupStyle } from "@/types";

function getStoredFontSize() {
  if (typeof window === "undefined") return 18;
  const savedFontSize = localStorage.getItem("readerFontSize");
  return savedFontSize ? parseInt(savedFontSize, 10) : 18;
}

function getStoredLineSpacing() {
  if (typeof window === "undefined") return 1.6;
  const savedLineSpacing = localStorage.getItem("readerLineSpacing");
  return savedLineSpacing ? parseFloat(savedLineSpacing) : 1.6;
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [vocabCount, setVocabCount] = useState(0);
  const [articleCount, setArticleCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [offlineCount] = useState(() => getOfflineArticles().length);
  const [defaultFontSize, setDefaultFontSize] = useState(getStoredFontSize);
  const [defaultLineSpacing, setDefaultLineSpacing] = useState(getStoredLineSpacing);
  const [lookupMode, setLookupMode] = useState<ReaderLookupStyle>(getStoredLookupStyle);
  const [reviewGoal, setReviewGoal] = useState(10);
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [reminderHour, setReminderHour] = useState(19);
  const [enableOffline, setEnableOffline] = useState(true);
  const [notificationState, setNotificationState] = useState(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default"
  );

  useEffect(() => {
    const loadSettings = async () => {
      const supabase = createClient();
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;
      setEmail(user.email || null);

      const [{ count: vCount }, { data: readingHistory }, { data: settings }, { count: due }] =
        await Promise.all([
          supabase
            .from("vocabulary_items")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("reading_history")
            .select("article_id")
            .eq("user_id", user.id),
          supabase
            .from("user_settings")
            .select(
              "font_size, line_spacing, review_goal, enable_notifications, reminder_hour, enable_offline, reader_mode"
            )
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("review_states")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .lte("next_review_at", new Date().toISOString()),
        ]);

      if (vCount !== null) setVocabCount(vCount);
      if (due !== null) setDueCount(due);
      if (readingHistory) {
        setArticleCount(
          new Set(
            readingHistory.map((row: { article_id: string }) => row.article_id)
          ).size
        );
      }

      if (settings?.font_size) {
        setDefaultFontSize(settings.font_size);
        localStorage.setItem("readerFontSize", settings.font_size.toString());
      }
      if (settings?.line_spacing) {
        setDefaultLineSpacing(settings.line_spacing);
        localStorage.setItem("readerLineSpacing", settings.line_spacing.toString());
      }
      if (settings?.review_goal) {
        setReviewGoal(settings.review_goal);
      }
      if (settings?.enable_notifications !== undefined) {
        setEnableNotifications(settings.enable_notifications);
      }
      if (typeof settings?.reminder_hour === "number") {
        setReminderHour(settings.reminder_hour);
      }
      if (settings?.enable_offline !== undefined) {
        setEnableOffline(settings.enable_offline);
      }
      if (settings?.reader_mode === "word" || settings?.reader_mode === "phrase") {
        setLookupMode(settings.reader_mode);
        persistLookupStyle(settings.reader_mode);
      }
    };

    void loadSettings();
  }, []);

  const saveSettings = async (values: Record<string, unknown>) => {
    const supabase = createClient();
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("user_settings").upsert(
      {
        user_id: user.id,
        ...values,
      },
      { onConflict: "user_id" }
    );
  };

  const handleFontSizeChange = (size: number) => {
    setDefaultFontSize(size);
    localStorage.setItem("readerFontSize", size.toString());
    void saveSettings({ font_size: size });
  };

  const handleLineSpacingChange = (spacing: number) => {
    setDefaultLineSpacing(spacing);
    localStorage.setItem("readerLineSpacing", spacing.toString());
    void saveSettings({ line_spacing: spacing });
  };

  const handleLookupModeChange = (mode: ReaderLookupStyle) => {
    setLookupMode(mode);
    persistLookupStyle(mode);
    void saveSettings({ reader_mode: mode });
  };

  const handleToggleNotifications = async () => {
    const nextValue = !enableNotifications;

    if (
      nextValue &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      const permission = await Notification.requestPermission();
      setNotificationState(permission);
      if (permission === "denied") {
        setEnableNotifications(false);
        await saveSettings({ enable_notifications: false });
        return;
      }
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationState(Notification.permission);
    }

    setEnableNotifications(nextValue);
    await saveSettings({ enable_notifications: nextValue });
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  };

  const reminderOptions = useMemo(
    () =>
      Array.from({ length: 16 }, (_, index) => index + 7).map((hour) => ({
        value: hour,
        label: `${hour.toString().padStart(2, "0")}:00`,
      })),
    []
  );

  const themes = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-5 py-6 pb-10 sm:px-6 sm:pb-12">
        <p className="editorial-label mb-2">Workspace Controls</p>
        <h1 className="mb-6 text-xl font-bold">Settings</h1>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
            Account
          </h2>
          <div className="glass-panel rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="glass-chip flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary">
                <User size={18} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{email || "..."}</p>
                <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted">
                  <span>{vocabCount} words</span>
                  <span>{articleCount} articles</span>
                  <span>{dueCount} due now</span>
                  <span>{offlineCount} offline copies</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
            Appearance
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 rounded-xl p-4 transition ${
                  theme === value
                    ? "glass-chip text-primary"
                    : "glass-panel text-muted"
                }`}
              >
                <Icon size={20} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
            Reading defaults
          </h2>
          <div className="glass-panel space-y-4 rounded-2xl p-4">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <BookOpen size={16} className="text-muted" />
                <span className="text-safe-title text-sm">Font size</span>
              </div>
              <div className="flex items-center gap-3 self-stretch sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleFontSizeChange(Math.max(14, defaultFontSize - 2))}
                  className="subtle-button flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:text-foreground"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-sm font-medium">{defaultFontSize}</span>
                <button
                  type="button"
                  onClick={() => handleFontSizeChange(Math.min(28, defaultFontSize + 2))}
                  className="subtle-button flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:text-foreground"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-safe-title text-sm">Line spacing</span>
              <div className="flex flex-wrap items-center gap-2">
                {[1.4, 1.6, 1.8, 2.0].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleLineSpacingChange(value)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      defaultLineSpacing === value
                        ? "glow-button text-primary-foreground"
                        : "subtle-button text-muted"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-safe-title text-sm">Lookup style</span>
              <div className="flex flex-wrap gap-2">
                {(["word", "phrase"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleLookupModeChange(mode)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      lookupMode === mode
                        ? "glow-button text-primary-foreground"
                        : "subtle-button text-muted"
                    }`}
                  >
                    {mode === "word" ? "Word focus" : "Smart"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
            Practice
          </h2>
          <div className="glass-panel space-y-4 rounded-2xl p-4">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <RotateCcw size={16} className="mt-0.5 text-primary" />
                <div className="min-w-0">
                  <p className="text-safe-title text-sm font-medium">Daily review goal</p>
                  <p className="text-safe-meta text-xs text-muted">
                    How many cards you want to clear per day.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 self-stretch sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(5, reviewGoal - 5);
                    setReviewGoal(next);
                    void saveSettings({ review_goal: next });
                  }}
                  className="subtle-button flex h-8 w-8 items-center justify-center rounded-lg text-muted"
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center text-sm font-medium">{reviewGoal}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.min(50, reviewGoal + 5);
                    setReviewGoal(next);
                    void saveSettings({ review_goal: next });
                  }}
                  className="subtle-button flex h-8 w-8 items-center justify-center rounded-lg text-muted"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
            Offline & reminders
          </h2>
          <div className="glass-panel space-y-4 rounded-2xl p-4">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <Cloud size={16} className="mt-0.5 text-primary" />
                <div className="min-w-0">
                  <p className="text-safe-title text-sm font-medium">Offline article cache</p>
                  <p className="text-safe-meta text-xs text-muted">
                    Save opened articles for reading when your connection drops.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !enableOffline;
                  setEnableOffline(next);
                  void saveSettings({ enable_offline: next });
                }}
                className={`w-full rounded-full px-3 py-1 text-xs font-medium sm:w-auto ${
                  enableOffline
                    ? "glow-button text-primary-foreground"
                    : "glass-chip text-muted"
                }`}
              >
                {enableOffline ? "On" : "Off"}
              </button>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <Bell size={16} className="mt-0.5 text-primary" />
                <div className="min-w-0">
                  <p className="text-safe-title text-sm font-medium">Review reminders</p>
                  <p className="text-safe-meta text-xs text-muted">
                    Browser permission: {notificationState}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleToggleNotifications()}
                className={`w-full rounded-full px-3 py-1 text-xs font-medium sm:w-auto ${
                  enableNotifications
                    ? "glow-button text-primary-foreground"
                    : "glass-chip text-muted"
                }`}
              >
                {enableNotifications ? "On" : "Off"}
              </button>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-safe-title text-sm font-medium">Reminder time</p>
                <p className="text-safe-meta text-xs text-muted">
                  Used for daily notification timing.
                </p>
              </div>
              <select
                value={reminderHour}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setReminderHour(next);
                  void saveSettings({ reminder_hour: next });
                }}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm outline-none sm:w-auto"
              >
                {reminderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <button
            type="button"
            onClick={handleSignOut}
            className="glass-panel flex w-full items-center justify-center gap-2 rounded-xl p-4 text-danger transition hover:bg-danger/10"
          >
            <LogOut size={18} />
            <span className="font-medium">Sign out</span>
          </button>
        </section>

        <section>
          <p className="text-safe-meta text-center text-xs text-muted">
            WordReader v0.2.0 - Learn English from real reading sessions
          </p>
        </section>
      </div>
    </AppShell>
  );
}

