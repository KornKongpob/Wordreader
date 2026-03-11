"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getUserWithProfile } from "@/lib/supabase/ensureProfile";
import type { ExtractedArticle } from "@/types";

function normalizeArticleInput(article: ExtractedArticle) {
  return {
    url: article.url,
    title: article.title,
    description: article.description ?? "",
    source_name: article.source_name,
    author: article.author,
    published_at: article.published_at,
    image_url: article.image_url,
    content: article.content,
  };
}

export function useArticleImport() {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveArticleAndOpen = async (article: ExtractedArticle) => {
    const supabase = createClient();
    if (!supabase) {
      throw new Error("Supabase is not configured. Check environment variables.");
    }

    const { user, error: userError } = await getUserWithProfile(supabase);

    if (!user || userError) {
      throw new Error(userError || "Please sign in again to continue.");
    }

    const normalized = normalizeArticleInput(article);
    const { data: existing } = await supabase
      .from("articles")
      .select("id")
      .eq("url", normalized.url)
      .maybeSingle();

    let articleId = existing?.id;

    if (!articleId) {
      const { data: inserted, error: insertError } = await supabase
        .from("articles")
        .insert(normalized)
        .select("id")
        .single();

      if (insertError || !inserted) {
        throw new Error("Could not save this article. Please try again.");
      }

      articleId = inserted.id;
    }

    await supabase.from("reading_history").upsert(
      {
        user_id: user.id,
        article_id: articleId,
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,article_id" }
    );

    router.push(`/read/${articleId}`);
  };

  const importFromUrl = async (url: string) => {
    setImporting(true);
    setError(null);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await response.json()) as { article?: ExtractedArticle; error?: string };

      if (!response.ok || !data.article) {
        throw new Error(data.error || "Could not import this article right now.");
      }

      await saveArticleAndOpen(data.article);
      return data.article;
    } catch (importError) {
      const message =
        importError instanceof Error
          ? importError.message
          : "Could not import this article right now.";
      setError(message);
      throw importError;
    } finally {
      setImporting(false);
    }
  };

  return {
    importing,
    error,
    setError,
    importFromUrl,
    saveArticleAndOpen,
  };
}
