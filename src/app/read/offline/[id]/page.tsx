"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpenText, Loader2 } from "lucide-react";
import ReaderView from "@/components/reader/ReaderView";
import OfflineReaderView from "@/components/reader/OfflineReaderView";
import { createClient } from "@/lib/supabase/client";
import { getOfflineArticle, type OfflineArticleRecord } from "@/lib/offline";
import type { Article } from "@/types";

export default function OfflineArticlePage() {
  const params = useParams();
  const id = params.id as string;
  const [offlineArticle, setOfflineArticle] = useState<OfflineArticleRecord | null>(null);
  const [liveArticle, setLiveArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadArticle = async () => {
      const savedArticle = getOfflineArticle(id);
      if (!isMounted) return;

      setOfflineArticle(savedArticle);

      if (typeof navigator !== "undefined" && navigator.onLine) {
        const supabase = createClient();

        if (supabase) {
          const { data, error } = await supabase
            .from("articles")
            .select("*")
            .eq("id", id)
            .maybeSingle();

          if (!isMounted) return;

          if (!error && data) {
            setLiveArticle(data as Article);
          }
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    void loadArticle();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (liveArticle) {
    return <ReaderView article={liveArticle} />;
  }

  if (offlineArticle) {
    return <OfflineReaderView article={offlineArticle} />;
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-5 text-center">
        <div className="glass-panel-strong w-full rounded-[2rem] p-6">
          <Loader2 size={28} className="mx-auto animate-spin text-muted" />
          <p className="mt-4 text-sm text-muted">Loading saved article...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-5 text-center">
      <div className="glass-panel-strong w-full rounded-[2rem] p-6">
        <div className="glass-chip mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.4rem] text-primary">
          <BookOpenText size={28} />
        </div>
        <p className="editorial-label mb-2">Saved Reading History</p>
        <h1 className="text-xl font-semibold tracking-[-0.02em]">
          Saved article not found
        </h1>
        <p className="mt-2 text-sm text-muted">
          This article is no longer available in your saved library.
        </p>
        <Link
          href="/read"
          className="glow-button mt-5 inline-flex rounded-full px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Back to library
        </Link>
      </div>
    </div>
  );
}
