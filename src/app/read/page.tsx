"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Loader2, BookOpen, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ReadPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Call the extraction API
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      // Save article to Supabase
      const supabase = createClient();
      if (!supabase) {
        setError("Supabase is not configured. Check environment variables.");
        setLoading(false);
        return;
      }
      const article = data.article;

      // Check if article already exists
      const { data: existing } = await supabase
        .from("articles")
        .select("id")
        .eq("url", article.url)
        .single();

      let articleId: string;

      if (existing) {
        articleId = existing.id;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("articles")
          .insert({
            url: article.url,
            title: article.title,
            source_name: article.source_name,
            author: article.author,
            published_at: article.published_at,
            image_url: article.image_url,
            content: article.content,
          })
          .select("id")
          .single();

        if (insertError || !inserted) {
          setError("Could not save article. Please try again.");
          setLoading(false);
          return;
        }
        articleId = inserted.id;
      }

      // Record reading history
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("reading_history").insert({
          user_id: user.id,
          article_id: articleId,
        });
      }

      // Navigate to reader
      router.push(`/read/${articleId}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="px-5 py-6 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-2">Read an Article</h1>
        <p className="text-muted text-sm mb-6">
          Paste a CNN article URL below to start reading.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.cnn.com/2024/..."
              required
              disabled={loading}
              className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition text-[16px]"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-danger text-sm bg-danger/10 rounded-lg px-3 py-2.5">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Extracting article...
              </>
            ) : (
              <>
                <BookOpen size={18} />
                Read Article
              </>
            )}
          </button>
        </form>

        <div className="mt-8 p-4 rounded-xl bg-card border border-border">
          <p className="text-sm text-muted">
            <strong className="text-foreground">Tip:</strong> Copy a CNN article
            URL from your browser, then paste it here. The app will extract the
            article text so you can read it in a clean format and save
            vocabulary.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
