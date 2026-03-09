"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { useTheme } from "@/components/layout/ThemeProvider";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Sun,
  Moon,
  Monitor,
  LogOut,
  Minus,
  Plus,
  User,
  BookOpen,
} from "lucide-react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [vocabCount, setVocabCount] = useState(0);
  const [articleCount, setArticleCount] = useState(0);
  const [defaultFontSize, setDefaultFontSize] = useState(18);
  const [defaultLineSpacing, setDefaultLineSpacing] = useState(1.6);

  useEffect(() => {
    // Load settings from localStorage
    const savedFontSize = localStorage.getItem("readerFontSize");
    const savedLineSpacing = localStorage.getItem("readerLineSpacing");
    if (savedFontSize) setDefaultFontSize(parseInt(savedFontSize));
    if (savedLineSpacing) setDefaultLineSpacing(parseFloat(savedLineSpacing));

    // Load user stats
    const loadStats = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;
      setEmail(user.email || null);

      const { count: vCount } = await supabase
        .from("vocabulary_items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { count: aCount } = await supabase
        .from("reading_history")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (vCount !== null) setVocabCount(vCount);
      if (aCount !== null) setArticleCount(aCount);
    };

    loadStats();
  }, []);

  const handleFontSizeChange = (size: number) => {
    setDefaultFontSize(size);
    localStorage.setItem("readerFontSize", size.toString());
  };

  const handleLineSpacingChange = (spacing: number) => {
    setDefaultLineSpacing(spacing);
    localStorage.setItem("readerLineSpacing", spacing.toString());
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  };

  const themes = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  return (
    <AppShell>
      <div className="px-5 py-6 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-6">Settings</h1>

        {/* Account */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wide">
            Account
          </h2>
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{email || "..."}</p>
                <div className="flex gap-4 text-xs text-muted mt-0.5">
                  <span>{vocabCount} words</span>
                  <span>{articleCount} articles read</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Theme selector */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wide">
            Appearance
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition ${
                  theme === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted"
                }`}
              >
                <Icon size={20} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Reading defaults */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wide">
            Reading Defaults
          </h2>
          <div className="p-4 rounded-xl bg-card border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-muted" />
                <span className="text-sm">Font Size</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    handleFontSizeChange(Math.max(14, defaultFontSize - 2))
                  }
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted hover:text-foreground transition"
                >
                  <Minus size={14} />
                </button>
                <span className="text-sm font-medium w-8 text-center">
                  {defaultFontSize}
                </span>
                <button
                  onClick={() =>
                    handleFontSizeChange(Math.min(28, defaultFontSize + 2))
                  }
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted hover:text-foreground transition"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Line Spacing</span>
              <div className="flex items-center gap-2">
                {[1.4, 1.6, 1.8, 2.0].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleLineSpacingChange(val)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      defaultLineSpacing === val
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Sign out */}
        <section className="mb-8">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-danger/30 text-danger hover:bg-danger/10 transition"
          >
            <LogOut size={18} />
            <span className="font-medium">Sign Out</span>
          </button>
        </section>

        {/* About */}
        <section>
          <p className="text-xs text-muted text-center">
            WordReader v0.1.0 — Learn English from real news
          </p>
        </section>
      </div>
    </AppShell>
  );
}
