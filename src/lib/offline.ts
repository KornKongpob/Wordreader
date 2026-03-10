"use client";

type Difficulty = "easy" | "medium" | "hard";

const OFFLINE_ARTICLES_KEY = "wordreader.offline.articles";
const OFFLINE_VOCAB_KEY = "wordreader.offline.vocabulary";
const OFFLINE_REVIEW_KEY = "wordreader.offline.review";

export interface OfflineArticleRecord {
  id: string;
  title: string;
  url: string;
  source_name: string;
  author: string | null;
  published_at: string | null;
  image_url: string | null;
  content: string;
  cached_at: string;
}

export interface OfflineVocabularyRecord {
  id: string;
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  difficulty: Difficulty;
  created_at: string;
  tags?: string[];
  folder_name?: string;
  starred?: boolean;
  notes?: string;
  last_source_name?: string;
}

export interface OfflineReviewCardRecord {
  vocabulary_item_id: string;
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  example_sentence: string;
  contextual_meaning: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  review_state_id: string;
}

function canUseStorage() {
  return typeof window !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;

  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota issues and keep the app usable.
  }
}

export function getOfflineArticles() {
  return readJson<OfflineArticleRecord[]>(OFFLINE_ARTICLES_KEY, []);
}

export function getOfflineArticle(id: string) {
  return getOfflineArticles().find((article) => article.id === id) ?? null;
}

export function saveOfflineArticle(
  article: Omit<OfflineArticleRecord, "cached_at">
) {
  const articles = getOfflineArticles().filter((item) => item.id !== article.id);
  const next = [{ ...article, cached_at: new Date().toISOString() }, ...articles].slice(
    0,
    12
  );

  writeJson(OFFLINE_ARTICLES_KEY, next);
}

export function saveOfflineVocabulary(items: OfflineVocabularyRecord[]) {
  writeJson(OFFLINE_VOCAB_KEY, {
    saved_at: new Date().toISOString(),
    items,
  });
}

export function getOfflineVocabulary() {
  return readJson<{ saved_at?: string; items: OfflineVocabularyRecord[] }>(
    OFFLINE_VOCAB_KEY,
    { items: [] }
  );
}

export function saveOfflineReviewDeck(cards: OfflineReviewCardRecord[]) {
  writeJson(OFFLINE_REVIEW_KEY, {
    saved_at: new Date().toISOString(),
    cards,
  });
}

export function getOfflineReviewDeck() {
  return readJson<{ saved_at?: string; cards: OfflineReviewCardRecord[] }>(
    OFFLINE_REVIEW_KEY,
    { cards: [] }
  );
}
