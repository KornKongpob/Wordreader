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
        <div className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary">
          <BookOpenText size={28} />
        </div>
        <h1 className="text-xl font-bold">Offline copy not found</h1>
        <p className="mt-2 text-sm text-muted">
          This article may have been removed from your local cache.
        </p>
        <Link
          href="/read"
          className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Back to library
        </Link>
      </div>
    );
  }

  return <OfflineReaderView article={article} />;
}
