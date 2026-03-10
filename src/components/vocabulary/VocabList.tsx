"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOfflineVocabulary, saveOfflineVocabulary } from "@/lib/offline";
import VocabCard from "./VocabCard";
import { Loader2, Search, SlidersHorizontal, Star } from "lucide-react";

interface VocabItem {
  id: string;
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  difficulty: "easy" | "medium" | "hard";
  created_at: string;
  tags?: string[];
  folder_name?: string;
  starred?: boolean;
  notes?: string;
  last_source_name?: string;
  due_now?: boolean;
}

type SortOption = "newest" | "oldest" | "alpha";
type DifficultyFilter = "all" | "easy" | "medium" | "hard";

export default function VocabList() {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [diffFilter, setDiffFilter] = useState<DifficultyFilter>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [folderFilter, setFolderFilter] = useState("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [dueOnly, setDueOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchVocab = async () => {
      const supabase = createClient();
      if (!supabase) {
        setItems(getOfflineVocabulary().items as VocabItem[]);
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const [{ data: vocabItems, error }, { data: dueStates }] = await Promise.all([
        supabase
          .from("vocabulary_items")
          .select(
            "id, word, thai_meaning, english_meaning, part_of_speech, difficulty, created_at, tags, folder_name, starred, notes, last_source_name"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("review_states")
          .select("vocabulary_item_id")
          .eq("user_id", user.id)
          .lte("next_review_at", new Date().toISOString()),
      ]);

      if (!error && vocabItems) {
        const dueIds = new Set((dueStates ?? []).map((state) => state.vocabulary_item_id));
        const normalizedItems = vocabItems.map((item) => ({
          ...item,
          due_now: dueIds.has(item.id),
        })) as VocabItem[];

        setItems(normalizedItems);
        saveOfflineVocabulary(normalizedItems);
      } else {
        setItems(getOfflineVocabulary().items as VocabItem[]);
      }

      setLoading(false);
    };

    void fetchVocab();
  }, []);

  const availableSources = useMemo(
    () =>
      [...new Set(items.map((item) => item.last_source_name).filter(Boolean))].sort(
        (a, b) => a!.localeCompare(b!)
      ),
    [items]
  );

  const availableFolders = useMemo(
    () =>
      [...new Set(items.map((item) => item.folder_name).filter(Boolean))].sort((a, b) =>
        a!.localeCompare(b!)
      ),
    [items]
  );

  const filtered = useMemo(() => {
    let result = [...items];

    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.word.toLowerCase().includes(query) ||
          item.thai_meaning.toLowerCase().includes(query) ||
          item.english_meaning.toLowerCase().includes(query) ||
          (item.notes || "").toLowerCase().includes(query) ||
          (item.tags || []).some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (diffFilter !== "all") {
      result = result.filter((item) => item.difficulty === diffFilter);
    }

    if (sourceFilter !== "all") {
      result = result.filter((item) => item.last_source_name === sourceFilter);
    }

    if (folderFilter !== "all") {
      result = result.filter((item) => item.folder_name === folderFilter);
    }

    if (starredOnly) {
      result = result.filter((item) => item.starred);
    }

    if (dueOnly) {
      result = result.filter((item) => item.due_now);
    }

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
  }, [diffFilter, dueOnly, folderFilter, items, search, sort, sourceFilter, starredOnly]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search words, notes, or tags..."
          className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-12 text-[16px] text-foreground outline-none transition focus:ring-2 focus:ring-primary/50"
        />
        <button
          type="button"
          onClick={() => setShowFilters((current) => !current)}
          className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition ${
            showFilters ? "bg-primary/10 text-primary" : "text-muted"
          }`}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {showFilters && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <div>
            <p className="mb-2 text-xs text-muted">Difficulty</p>
            <div className="flex flex-wrap gap-2">
              {(["all", "easy", "medium", "hard"] as DifficultyFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDiffFilter(value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    diffFilter === value
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted"
                  }`}
                >
                  {value === "all" ? "All" : value}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-muted">Quick filters</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStarredOnly((current) => !current)}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  starredOnly
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted"
                }`}
              >
                <Star size={12} />
                Starred
              </button>
              <button
                type="button"
                onClick={() => setDueOnly((current) => !current)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  dueOnly
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted"
                }`}
              >
                Due now
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-2">
              <span className="text-xs text-muted">Source</span>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
              >
                <option value="all">All sources</option>
                {availableSources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs text-muted">Folder</span>
              <select
                value={folderFilter}
                onChange={(event) => setFolderFilter(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
              >
                <option value="all">All folders</option>
                {availableFolders.map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-2 text-xs text-muted">Sort</p>
            <div className="flex gap-2">
              {([
                ["newest", "Newest"],
                ["oldest", "Oldest"],
                ["alpha", "A-Z"],
              ] as [SortOption, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSort(value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    sort === value
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

      <p className="text-xs text-muted">
        {filtered.length} word{filtered.length !== 1 ? "s" : ""}
        {search || diffFilter !== "all" || sourceFilter !== "all" || folderFilter !== "all" || starredOnly || dueOnly
          ? " found"
          : " saved"}
      </p>

      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted">
            {items.length === 0
              ? "No words saved yet. Start reading to build your vocabulary."
              : "No words match your current filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <VocabCard key={item.id} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}
