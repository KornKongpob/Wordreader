import AppShell from "@/components/layout/AppShell";
import LatestHeadlines from "@/components/home/LatestHeadlines";
import OnboardingChecklist from "@/components/home/OnboardingChecklist";
import { calculateLocalDayStreak, getStartOfLocalToday } from "@/lib/local-date";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  BookOpen,
  BookOpenText,
  Flame,
  Library,
  RotateCcw,
  Sparkles,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface ReadingHistoryWithArticle {
  article_id: string;
  updated_at?: string;
  last_position?: number;
  is_finished?: boolean;
  articles?:
    | {
        id: string;
        title: string;
        source_name: string;
        image_url: string | null;
      }
    | {
        id: string;
        title: string;
        source_name: string;
        image_url: string | null;
      }[]
    | null;
}

function formatRelativeTime(value?: string) {
  if (!value) return "Just now";

  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "Updated just now";
  if (diffHours < 24) return `Updated ${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `Updated ${diffDays}d ago`;
}

function getArticleMeta(entry: ReadingHistoryWithArticle) {
  return Array.isArray(entry.articles) ? entry.articles[0] : entry.articles;
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg px-5 py-6">
          <p className="text-sm text-muted">Loading your dashboard...</p>
        </div>
      </AppShell>
    );
  }

  const startOfToday = getStartOfLocalToday().toISOString();

  const [
    { data: settings },
    { count: dueCount },
    { count: reviewedToday },
    { count: vocabCount },
    { data: reviewEventDays },
    { data: readingHistory },
  ] = await Promise.all([
    supabase
      .from("user_settings")
      .select("review_goal, onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("review_states")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .lte("next_review_at", new Date().toISOString()),
    supabase
      .from("review_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("reviewed_at", startOfToday),
    supabase
      .from("vocabulary_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("review_events")
      .select("reviewed_at")
      .eq("user_id", user.id)
      .order("reviewed_at", { ascending: false })
      .limit(45),
    supabase
      .from("reading_history")
      .select("article_id, updated_at, last_position, is_finished, articles(id, title, source_name, image_url)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  const uniqueHistory = new Map<string, ReadingHistoryWithArticle>();
  for (const row of (readingHistory ?? []) as ReadingHistoryWithArticle[]) {
    if (!uniqueHistory.has(row.article_id)) {
      uniqueHistory.set(row.article_id, row);
    }
  }

  const recentHistory = [...uniqueHistory.values()];
  const continueReading = recentHistory.filter((row) => !row.is_finished).slice(0, 3);
  const distinctArticleCount = recentHistory.length;
  const streak = calculateLocalDayStreak((reviewEventDays ?? []).map((event) => event.reviewed_at));
  const reviewGoal = settings?.review_goal ?? 10;
  const reviewedCount = reviewedToday ?? 0;
  const progress = Math.min(100, Math.round((reviewedCount / reviewGoal) * 100));

  const onboardingItems = [
    { label: "Read your first article", done: distinctArticleCount > 0 },
    { label: "Save 3 useful words", done: (vocabCount ?? 0) >= 3 },
    { label: "Finish your first review session", done: streak > 0 || reviewedCount > 0 },
  ];

  const firstName = user?.email ? user.email.split("@")[0] : "reader";

  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-5 py-6">
        <section className="glass-hero mb-6 rounded-[2rem] p-6">
          <div className="mb-4 flex items-center gap-2 text-sm text-primary">
            <Sparkles size={16} />
            <span>Daily reading dashboard</span>
          </div>
          <p className="editorial-label mb-2">Today&apos;s Reading Desk</p>
          <h1 className="text-safe-title text-3xl font-bold tracking-tight">
            Hello, {firstName}
          </h1>
          <p className="text-safe-body mt-2 text-sm text-muted">
            You&apos;ve reviewed {reviewedCount}/{reviewGoal} cards today and have{" "}
            {dueCount ?? 0} waiting next. Fresh headlines are ready whenever you want a new article.
          </p>

          <div className="glass-panel mt-5 rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Daily review goal</span>
              <span className="text-muted">{reviewedCount}/{reviewGoal}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-primary/10">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              <Flame size={14} className="text-warning" />
              <span className="text-safe-meta">{streak} day streak</span>
            </div>
          </div>
        </section>

        <OnboardingChecklist
          items={onboardingItems}
          initiallyDismissed={Boolean(settings?.onboarding_completed)}
        />

        <section className="mb-6 grid grid-cols-2 gap-3">
          <div className="glass-panel rounded-2xl p-4">
            <p className="editorial-label">Vocabulary</p>
            <p className="mt-2 text-2xl font-bold">{vocabCount ?? 0}</p>
            <p className="mt-1 text-xs text-muted">Saved words ready to revisit</p>
          </div>
          <div className="glass-panel rounded-2xl p-4">
            <p className="editorial-label">Articles</p>
            <p className="mt-2 text-2xl font-bold">{distinctArticleCount}</p>
            <p className="mt-1 text-xs text-muted">Distinct pieces you&apos;ve read</p>
          </div>
        </section>

        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
              Quick actions
            </h2>
            <Link href="/settings" className="text-xs font-medium text-primary hover:underline">
              Tune your setup
            </Link>
          </div>
          <div className="grid gap-3">
            <Link
              href="/read"
              className="glow-button flex items-start gap-4 rounded-[1.7rem] px-4 py-4 text-primary-foreground transition active:scale-[0.98] sm:items-center"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <BookOpen size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-safe-title text-lg font-semibold">Browse today&apos;s news</p>
                <p className="text-safe-body text-sm opacity-80">
                  Discover live headlines, then open the ones you want to study
                </p>
              </div>
            </Link>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/vocabulary"
                className="glass-panel rounded-2xl p-4 transition active:scale-[0.98]"
              >
                <Library size={18} className="mb-3 text-primary" />
                <p className="font-semibold">Organize words</p>
                <p className="mt-1 text-xs text-muted">Tags, notes, folders, favorites</p>
              </Link>
              <Link
                href="/review"
                className="glass-panel rounded-2xl p-4 transition active:scale-[0.98]"
              >
                <RotateCcw size={18} className="mb-3 text-primary" />
                <p className="font-semibold">Review deck</p>
                <p className="mt-1 text-xs text-muted">Practice due cards and keep streaks alive</p>
              </Link>
            </div>
          </div>
        </section>

        <LatestHeadlines />

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
              Continue reading
            </h2>
            <Link href="/read" className="text-xs font-medium text-primary hover:underline">
              View library
            </Link>
          </div>

          {continueReading.length === 0 ? (
            <div className="glass-panel rounded-2xl p-5 text-center">
              <BookOpenText size={22} className="mx-auto mb-3 text-primary" />
              <p className="font-medium">No article in progress yet</p>
              <p className="mt-1 text-sm text-muted">
                Start reading and WordReader will keep your place for you.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {continueReading.map((entry) => {
                const articleMeta = getArticleMeta(entry);

                return (
                  <Link
                    key={entry.article_id}
                    href={`/read/${entry.article_id}`}
                    className="glass-panel flex items-start gap-3 rounded-2xl p-4 transition active:scale-[0.98]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="chip-truncate inline-block max-w-full text-xs uppercase tracking-wide text-primary">
                        {articleMeta?.source_name ?? "Article"}
                      </p>
                      <p className="text-safe-title mt-1 line-clamp-2 font-semibold">
                        {articleMeta?.title ?? "Untitled article"}
                      </p>
                      <p className="text-safe-meta mt-2 text-xs text-muted">
                        {formatRelativeTime(entry.updated_at)}
                      </p>
                    </div>
                    <div className="glass-chip shrink-0 self-start rounded-full px-3 py-1 text-xs text-muted">
                      {entry.last_position && entry.last_position > 0 ? "Resume" : "Open"}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
