"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, SlidersHorizontal, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getOfflineVocabulary, saveOfflineVocabulary } from "@/lib/offline";
import VocabCard from "./VocabCard";

interface VocabItem {
  id: string;
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  difficulty: "easy" | "medium" | "hard";
  lemma?: string;
  cefr_level?: string;
  created_at: string;
  tags?: string[];
  folder_name?: string;
  starred?: boolean;
  notes?: string;
  last_source_name?: string;
  due_now?: boolean;
}

interface DueStateRow {
  vocabulary_item_id: string;
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
            "id, word, thai_meaning, english_meaning, part_of_speech, difficulty, lemma, cefr_level, created_at, tags, folder_name, starred, notes, last_source_name"
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
        const dueIds = new Set(
          ((dueStates ?? []) as DueStateRow[]).map((state) => state.vocabulary_item_id)
        );
        const normalizedItems = (vocabItems as VocabItem[]).map((item) => ({
          ...item,
          due_now: dueIds.has(item.id),
        }));

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
          (item.lemma || "").toLowerCase().includes(query) ||
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

  const hasActiveFilters =
    search.trim().length > 0 ||
    diffFilter !== "all" ||
    sourceFilter !== "all" ||
    folderFilter !== "all" ||
    starredOnly ||
    dueOnly;

  const resetFilters = () => {
    setSearch("");
    setSort("newest");
    setDiffFilter("all");
    setSourceFilter("all");
    setFolderFilter("all");
    setStarredOnly(false);
    setDueOnly(false);
  };

  if (loading) {
    return (
      <div className="glass-panel flex items-center justify-center rounded-[1.75rem] py-16">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-[1.75rem] p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="editorial-label mb-1">Find And Organize</p>
            <p className="text-safe-body text-sm text-muted">
              Search by meaning, source, note, folder, or review urgency.
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="glass-chip rounded-full px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
            >
              Reset
            </button>
          )}
        </div>

        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search words, notes, or tags..."
            className="glass-input w-full rounded-[1.35rem] py-3.5 pl-11 pr-28 text-[16px] text-foreground outline-none transition focus:ring-2 focus:ring-primary/35"
          />
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-xs font-medium transition ${
              showFilters
                ? "glow-button text-primary-foreground"
                : "glass-chip text-muted hover:text-foreground"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <SlidersHorizontal size={16} />
              Filters
            </span>
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="glass-panel space-y-4 rounded-[1.75rem] p-4">
          <div>
            <p className="editorial-label mb-2">Difficulty</p>
            <div className="flex flex-wrap gap-2">
              {(["all", "easy", "medium", "hard"] as DifficultyFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDiffFilter(value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    diffFilter === value
                      ? "glow-button text-primary-foreground"
                      : "glass-chip text-muted hover:text-foreground"
                  }`}
                >
                  {value === "all" ? "All" : value}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="editorial-label mb-2">Quick Filters</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStarredOnly((current) => !current)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  starredOnly
                    ? "glow-button text-primary-foreground"
                    : "glass-chip text-muted hover:text-foreground"
                }`}
              >
                <Star size={12} />
                Starred
              </button>
              <button
                type="button"
                onClick={() => setDueOnly((current) => !current)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  dueOnly
                    ? "glow-button text-primary-foreground"
                    : "glass-chip text-muted hover:text-foreground"
                }`}
              >
                Due now
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="editorial-label">Source</span>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className="glass-input w-full rounded-[1.15rem] px-3 py-2.5 text-sm outline-none"
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
              <span className="editorial-label">Folder</span>
              <select
                value={folderFilter}
                onChange={(event) => setFolderFilter(event.target.value)}
                className="glass-input w-full rounded-[1.15rem] px-3 py-2.5 text-sm outline-none"
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
            <p className="editorial-label mb-2">Sort</p>
            <div className="flex flex-wrap gap-2">
              {([
                ["newest", "Newest"],
                ["oldest", "Oldest"],
                ["alpha", "A-Z"],
              ] as [SortOption, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSort(value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    sort === value
                      ? "glow-button text-primary-foreground"
                      : "glass-chip text-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-start gap-1 px-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="editorial-label">
          {filtered.length} word{filtered.length !== 1 ? "s" : ""}
          {hasActiveFilters ? " found" : " saved"}
        </p>
        {items.length > 0 && (
          <span className="text-safe-meta text-xs text-muted">
            {dueOnly ? "Only showing words due now." : "Tap a word for notes and context."}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-panel rounded-[1.75rem] px-5 py-10 text-center">
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
