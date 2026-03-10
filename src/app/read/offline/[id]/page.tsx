"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpenText } from "lucide-react";
import OfflineReaderView from "@/components/reader/OfflineReaderView";
import type { OfflineArticleRecord } from "@/lib/offline";
import { getOfflineArticle } from "@/lib/offline";

export default function OfflineArticlePage() {
  const params = useParams();
  const id = params.id as string;
  const [article, setArticle] = useState<OfflineArticleRecord | null>(null);

  useEffect(() => {
    setArticle(getOfflineArticle(id));
  }, [id]);

  if (!article) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-5 text-center">
        <div className="glass-panel-strong w-full rounded-[2rem] p-6">
          <div className="glass-chip mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.4rem] text-primary">
            <BookOpenText size={28} />
          </div>
          <p className="editorial-label mb-2">Offline Library</p>
          <h1 className="text-xl font-semibold tracking-[-0.02em]">
            Offline copy not found
          </h1>
          <p className="mt-2 text-sm text-muted">
            This article may have been removed from your local cache.
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

  return <OfflineReaderView article={article} />;
}
