"use client";

import { useEffect, useState } from "react";
import type { NewsFeedItem, NewsFeedResponse, NewsSection } from "@/types";

export function useNewsFeed(section: NewsSection | "all" = "all") {
  const [items, setItems] = useState<NewsFeedItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadFeed = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/news?section=${section}`);
        const data = (await response.json()) as NewsFeedResponse & { error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Could not load the latest news.");
        }

        if (!isMounted) return;

        setItems(data.items ?? []);
        setWarnings(data.warnings ?? []);
      } catch (loadError) {
        if (!isMounted) return;

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load the latest news."
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadFeed();

    return () => {
      isMounted = false;
    };
  }, [section]);

  return {
    items,
    warnings,
    loading,
    error,
  };
}
