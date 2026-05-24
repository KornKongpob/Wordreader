"use client";

import { useMemo, useState } from "react";
import {
  BookMarked,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";
import {
  createArticleVocabularySavePayload,
  getArticleVocabularyKey,
} from "@/lib/article-vocabulary";
import type {
  ArticleVocabularySuggestion,
  SavedVocabularyPreview,
} from "@/types";

interface ArticleVocabularySuggestionsProps {
  articleId: string;
  articleTitle: string;
  articleSourceName: string;
  content: string;
  savedVocabulary: SavedVocabularyPreview[];
  onSaved: (item: SavedVocabularyPreview) => void;
}

interface ArticleVocabularyResponse {
  suggestions?: ArticleVocabularySuggestion[];
  error?: string;
}

type SuggestionStatus = "idle" | "saving" | "saved" | "duplicate" | "error";

interface SuggestionSaveState {
  status: SuggestionStatus;
  message?: string;
}

function getStatusLabel(state: SuggestionSaveState | undefined) {
  if (!state) return "";

  switch (state.status) {
    case "saving":
      return "Saving";
    case "saved":
      return "Saved";
    case "duplicate":
      return "Already saved";
    case "error":
      return state.message || "Save failed";
    default:
      return "";
  }
}

export default function ArticleVocabularySuggestions({
  articleId,
  articleTitle,
  articleSourceName,
  content,
  savedVocabulary,
  onSaved,
}: ArticleVocabularySuggestionsProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingSelected, setSavingSelected] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<ArticleVocabularySuggestion[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [saveStates, setSaveStates] = useState<Record<string, SuggestionSaveState>>({});

  const savedKeys = useMemo(
    () => new Set(savedVocabulary.map((item) => getArticleVocabularyKey(item.word))),
    [savedVocabulary]
  );

  const getSuggestionState = (suggestion: ArticleVocabularySuggestion) => {
    const key = getArticleVocabularyKey(suggestion.word);
    return saveStates[key] ?? (savedKeys.has(key) ? { status: "duplicate" as const } : undefined);
  };

  const saveableSelectedCount = suggestions.filter((suggestion) => {
    const key = getArticleVocabularyKey(suggestion.word);
    const state = getSuggestionState(suggestion);
    return (
      selectedKeys.has(key) &&
      state?.status !== "duplicate" &&
      state?.status !== "saved" &&
      state?.status !== "saving"
    );
  }).length;

  const loadSuggestions = async () => {
    if (loading || suggestions.length > 0) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/article-vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId,
          articleTitle,
          content,
        }),
      });
      const data = (await response.json()) as ArticleVocabularyResponse;

      if (!response.ok || !data.suggestions) {
        setError(data.error || "Could not find useful words for this article.");
        return;
      }

      setSuggestions(data.suggestions);
      setSelectedKeys(
        new Set(
          data.suggestions
            .map((suggestion) => getArticleVocabularyKey(suggestion.word))
            .filter((key) => !savedKeys.has(key))
        )
      );
    } catch {
      setError("Could not find useful words for this article right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);
    void loadSuggestions();
  };

  const toggleSuggestion = (suggestion: ArticleVocabularySuggestion) => {
    const key = getArticleVocabularyKey(suggestion.word);
    const state = getSuggestionState(suggestion);
    if (state?.status === "duplicate" || state?.status === "saved" || savingSelected) {
      return;
    }

    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSaveSelected = async () => {
    if (saveableSelectedCount === 0 || savingSelected) {
      return;
    }

    setSavingSelected(true);

    for (const suggestion of suggestions) {
      const key = getArticleVocabularyKey(suggestion.word);
      const state = getSuggestionState(suggestion);
      if (!selectedKeys.has(key) || state?.status === "saved" || state?.status === "saving") {
        continue;
      }

      if (state?.status === "duplicate" || savedKeys.has(key)) {
        setSaveStates((current) => ({
          ...current,
          [key]: { status: "duplicate" },
        }));
        continue;
      }

      setSaveStates((current) => ({
        ...current,
        [key]: { status: "saving" },
      }));

      try {
        const response = await fetch("/api/vocabulary/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            createArticleVocabularySavePayload({
              articleId,
              articleTitle,
              articleSourceName,
              suggestion,
            })
          ),
        });
        const data = (await response.json()) as {
          item?: SavedVocabularyPreview;
          error?: string;
        };

        if (!response.ok || !data.item) {
          setSaveStates((current) => ({
            ...current,
            [key]: { status: "error", message: data.error || "Save failed" },
          }));
          continue;
        }

        onSaved(data.item);
        setSaveStates((current) => ({
          ...current,
          [key]: { status: "saved" },
        }));
      } catch {
        setSaveStates((current) => ({
          ...current,
          [key]: { status: "error", message: "Save failed" },
        }));
      }
    }

    setSavingSelected(false);
  };

  return (
    <section className="mt-5 border-t border-border/60 pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <BookMarked size={18} className="mt-0.5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-safe-title text-sm font-semibold">Article Vocabulary</p>
            <p className="text-safe-meta mt-1 text-xs text-muted">
              Pick useful article words and save them for review.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          className="subtle-button inline-flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground disabled:opacity-60 sm:w-auto"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading
            ? "Finding..."
            : expanded && suggestions.length > 0
              ? "Hide words"
              : suggestions.length > 0
                ? "Show words"
                : "Find useful words in this article"}
          {!loading && (expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {error && (
            <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          {loading && (
            <div className="flex items-center gap-2 py-3 text-sm text-muted">
              <Loader2 size={16} className="animate-spin" />
              <span>Finding article vocabulary...</span>
            </div>
          )}

          {!loading && suggestions.length === 0 && !error && (
            <div className="glass-panel flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-muted">
              <Sparkles size={16} />
              No suggestions yet.
            </div>
          )}

          {suggestions.length > 0 && (
            <>
              <div className="space-y-2">
                {suggestions.map((suggestion) => {
                  const key = getArticleVocabularyKey(suggestion.word);
                  const state = getSuggestionState(suggestion);
                  const statusLabel = getStatusLabel(state);
                  const unavailable =
                    state?.status === "duplicate" ||
                    state?.status === "saved" ||
                    state?.status === "saving";
                  const disabled = savingSelected || unavailable;

                  return (
                    <label
                      key={`${key}-${suggestion.original_sentence}`}
                      className={`glass-chip flex items-start gap-3 rounded-[1.2rem] px-3 py-3 text-left ${
                        disabled ? "opacity-75" : "cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(key) && !unavailable}
                        disabled={disabled}
                        onChange={() => toggleSuggestion(suggestion)}
                        className="mt-1 h-4 w-4 shrink-0 accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-safe-title font-semibold">{suggestion.word}</p>
                          {suggestion.cefr_level && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              {suggestion.cefr_level}
                            </span>
                          )}
                          <span className="rounded-full bg-muted/10 px-2 py-0.5 text-[10px] font-medium text-muted">
                            {suggestion.difficulty}
                          </span>
                          {state?.status === "saved" && (
                            <CheckCircle2 size={14} className="text-success" />
                          )}
                        </div>
                        <p className="text-safe-body mt-1 text-sm text-muted">
                          {suggestion.thai_meaning}
                        </p>
                        <p className="text-safe-meta mt-1 line-clamp-2 text-xs text-muted">
                          {suggestion.english_meaning}
                        </p>
                        <p className="text-safe-meta mt-2 line-clamp-2 text-xs italic text-muted">
                          &ldquo;{suggestion.original_sentence}&rdquo;
                        </p>
                        <p className="text-safe-meta mt-2 text-xs text-muted">
                          {suggestion.why_useful_th}
                        </p>
                        {statusLabel && (
                          <p
                            className={`mt-2 text-xs ${
                              state?.status === "error" ? "text-danger" : "text-primary"
                            }`}
                          >
                            {statusLabel}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => void handleSaveSelected()}
                disabled={saveableSelectedCount === 0 || savingSelected}
                className="glow-button inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {savingSelected ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {savingSelected
                  ? "Saving selected..."
                  : `Save selected${saveableSelectedCount > 0 ? ` (${saveableSelectedCount})` : ""}`}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
