"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserWithProfile } from "@/lib/supabase/ensureProfile";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2 } from "lucide-react";

type Mode = "signin" | "signup";

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured. Please check environment variables on Vercel.");
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage("Check your email to confirm your account.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        await getUserWithProfile(supabase);
        router.push("/");
        router.refresh();
      }
    }

    setLoading(false);
  };

  return (
    <div className="editorial-shell min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-72 bg-[radial-gradient(circle_at_top,rgba(36,88,220,0.2),transparent_42%)]" />
      <div className="pointer-events-none absolute left-1/2 top-24 z-0 h-56 w-56 -translate-x-1/2 rounded-full bg-primary/14 blur-3xl" />
      <div className="glass-panel-strong relative z-10 w-full max-w-sm rounded-[2rem] px-6 py-8">
        <div className="mb-8 flex flex-col items-center">
          <div className="glow-button mb-4 flex h-16 w-16 items-center justify-center rounded-[1.4rem] text-primary-foreground">
            <BookOpen size={32} className="text-primary-foreground" />
          </div>
          <p className="editorial-label mb-2">Editorial English Reader</p>
          <h1 className="text-3xl font-bold tracking-tight">WordReader</h1>
          <p className="mt-2 max-w-xs text-center text-sm text-muted">
            Learn English through clean, focused news reading with a softer glass interface.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="glass-input w-full rounded-xl px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="At least 6 characters"
              className="glass-input w-full rounded-xl px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {message && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="glow-button flex w-full items-center justify-center gap-2 rounded-xl py-3 font-medium text-primary-foreground transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {mode === "signin" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setMessage(null);
                }}
                className="font-medium text-primary"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setMessage(null);
                }}
                className="font-medium text-primary"
              >
                Sign In
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
