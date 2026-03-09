import AppShell from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { BookOpen, Library, RotateCcw } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AppShell>
      <div className="px-5 py-6 max-w-lg mx-auto">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            Hello{user?.email ? `, ${user.email.split("@")[0]}` : ""} 👋
          </h1>
          <p className="text-muted text-sm mt-1">
            What would you like to do today?
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid gap-4">
          <Link
            href="/read"
            className="flex items-center gap-4 p-4 rounded-2xl bg-primary text-primary-foreground active:scale-[0.98] transition"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <BookOpen size={24} />
            </div>
            <div>
              <p className="font-semibold text-lg">Read an Article</p>
              <p className="text-sm opacity-80">
                Paste a CNN URL and start reading
              </p>
            </div>
          </Link>

          <Link
            href="/vocabulary"
            className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card active:scale-[0.98] transition"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Library size={24} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold">My Vocabulary</p>
              <p className="text-sm text-muted">
                Browse your saved words
              </p>
            </div>
          </Link>

          <Link
            href="/review"
            className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card active:scale-[0.98] transition"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <RotateCcw size={24} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold">Review Flashcards</p>
              <p className="text-sm text-muted">
                Practice your vocabulary
              </p>
            </div>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
