"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import VocabCard from "./VocabCard";
import { Search, SlidersHorizontal, Loader2 } from "lucide-react";

interface VocabItem {
  id: string;
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  difficulty: "easy" | "medium" | "hard";
  created_at: string;
}

type SortOption = "newest" | "oldest" | "alpha";
type DifficultyFilter = "all" | "easy" | "medium" | "hard";

export default function VocabList() {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [diffFilter, setDiffFilter] = useState<DifficultyFilter>("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchVocab = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("vocabulary_items")
        .select("id, word, thai_meaning, english_meaning, part_of_speech, difficulty, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setItems(data as VocabItem[]);
      }
      setLoading(false);
    };

    fetchVocab();
  }, []);

  const filtered = useMemo(() => {
    let result = [...items];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.word.toLowerCase().includes(q) ||
          item.thai_meaning.toLowerCase().includes(q) ||
          item.english_meaning.toLowerCase().includes(q)
      );
    }

    // Difficulty filter
    if (diffFilter !== "all") {
      result = result.filter((item) => item.difficulty === diffFilter);
    }

    // Sort
    switch (sort) {
      case "oldest":
        result.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case "alpha":
        result.sort((a, b) => a.word.localeCompare(b.word));
        break;
      default:
        result.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return result;
  }, [items, search, sort, diffFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search words..."
          className="w-full pl-10 pr-12 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition text-[16px]"
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition ${
            showFilters ? "text-primary bg-primary/10" : "text-muted"
          }`}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-3 rounded-xl bg-card border border-border space-y-3">
          <div>
            <p className="text-xs text-muted mb-2">Difficulty</p>
            <div className="flex gap-2">
              {(["all", "easy", "medium", "hard"] as DifficultyFilter[]).map(
                (d) => (
                  <button
                    key={d}
                    onClick={() => setDiffFilter(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      diffFilter === d
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted"
                    }`}
                  >
                    {d === "all" ? "All" : d}
                  </button>
                )
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted mb-2">Sort</p>
            <div className="flex gap-2">
              {([
                ["newest", "Newest"],
                ["oldest", "Oldest"],
                ["alpha", "A-Z"],
              ] as [SortOption, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setSort(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    sort === val
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-muted">
        {filtered.length} word{filtered.length !== 1 ? "s" : ""}
        {search || diffFilter !== "all" ? " found" : " saved"}
      </p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted text-sm">
            {items.length === 0
              ? "No words saved yet. Start reading articles to build your vocabulary!"
              : "No words match your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <VocabCard key={item.id} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}
