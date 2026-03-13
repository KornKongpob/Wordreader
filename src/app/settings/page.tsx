"use client";

import { useEffect, useMemo, useState } from "react";
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
import AppShell from "@/components/layout/AppShell";
import { useUserSettings } from "@/components/layout/UserSettingsProvider";
import { useTheme } from "@/components/layout/ThemeProvider";
import { getOfflineArticles } from "@/lib/offline";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useUserSettings();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [vocabCount, setVocabCount] = useState(0);
  const [articleCount, setArticleCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [offlineCount] = useState(() => getOfflineArticles().length);
  const [notificationState, setNotificationState] = useState(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default"
  );

  useEffect(() => {
    const loadAccountSummary = async () => {
      const supabase = createClient();
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;
      setEmail(user.email || null);

      const [{ count: vCount }, { data: readingHistory }, { count: due }] = await Promise.all([
        supabase
          .from("vocabulary_items")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("reading_history")
          .select("article_id")
          .eq("user_id", user.id),
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
          new Set(readingHistory.map((row: { article_id: string }) => row.article_id)).size
        );
      }
    };

    void loadAccountSummary();
  }, []);

  const handleToggleNotifications = async () => {
    const nextValue = !settings.enableNotifications;

    if (
      nextValue &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      const permission = await Notification.requestPermission();
      setNotificationState(permission);
      if (permission === "denied") {
        await updateSettings({ enableNotifications: false });
        return;
      }
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationState(Notification.permission);
    }

    await updateSettings({ enableNotifications: nextValue });
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
                  theme === value ? "glass-chip text-primary" : "glass-panel text-muted"
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
                  onClick={() => void updateSettings({ fontSize: Math.max(14, settings.fontSize - 2) })}
                  className="subtle-button flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:text-foreground"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-sm font-medium">{settings.fontSize}</span>
                <button
                  type="button"
                  onClick={() => void updateSettings({ fontSize: Math.min(28, settings.fontSize + 2) })}
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
                    onClick={() => void updateSettings({ lineSpacing: value })}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      settings.lineSpacing === value
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
                    onClick={() => void updateSettings({ readerMode: mode })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      settings.readerMode === mode
                        ? "glow-button text-primary-foreground"
                        : "subtle-button text-muted"
                    }`}
                  >
                    {mode === "word" ? "Word focus" : "Smart"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-safe-title text-sm">Sentence action</span>
              <div className="flex flex-wrap gap-2">
                {(["translate", "explain"] as const).map((intent) => (
                  <button
                    key={intent}
                    type="button"
                    onClick={() => void updateSettings({ defaultLookupIntent: intent })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      settings.defaultLookupIntent === intent
                        ? "glow-button text-primary-foreground"
                        : "subtle-button text-muted"
                    }`}
                  >
                    {intent === "translate" ? "Translate first" : "Explain first"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-safe-title text-sm">Tap behavior</span>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: "word", label: "Tap word" },
                  { value: "sentence", label: "Tap sentence" },
                  { value: "off", label: "Off" },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => void updateSettings({ tapBehavior: option.value })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      settings.tapBehavior === option.value
                        ? "glow-button text-primary-foreground"
                        : "subtle-button text-muted"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-safe-title text-sm">App language</span>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: "en", label: "English UI" },
                  { value: "th", label: "Thai UI" },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => void updateSettings({ uiLanguage: option.value })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      settings.uiLanguage === option.value
                        ? "glow-button text-primary-foreground"
                        : "subtle-button text-muted"
                    }`}
                  >
                    {option.label}
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
                  onClick={() =>
                    void updateSettings({ reviewGoal: Math.max(5, settings.reviewGoal - 5) })
                  }
                  className="subtle-button flex h-8 w-8 items-center justify-center rounded-lg text-muted"
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center text-sm font-medium">{settings.reviewGoal}</span>
                <button
                  type="button"
                  onClick={() =>
                    void updateSettings({ reviewGoal: Math.min(50, settings.reviewGoal + 5) })
                  }
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
                onClick={() => void updateSettings({ enableOffline: !settings.enableOffline })}
                className={`w-full rounded-full px-3 py-1 text-xs font-medium sm:w-auto ${
                  settings.enableOffline
                    ? "glow-button text-primary-foreground"
                    : "glass-chip text-muted"
                }`}
              >
                {settings.enableOffline ? "On" : "Off"}
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
                  settings.enableNotifications
                    ? "glow-button text-primary-foreground"
                    : "glass-chip text-muted"
                }`}
              >
                {settings.enableNotifications ? "On" : "Off"}
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
                value={settings.reminderHour}
                onChange={(event) => {
                  void updateSettings({ reminderHour: Number(event.target.value) });
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
