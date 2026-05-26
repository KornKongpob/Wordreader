// Database row types

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  url: string;
  title: string;
  description?: string;
  source_name: string;
  author: string | null;
  published_at: string | null;
  image_url: string | null;
  content: string;
  created_at: string;
}

export interface ReadingHistory {
  id: string;
  user_id: string;
  article_id: string;
  read_at: string;
  updated_at?: string;
  reading_time_sec: number | null;
  last_position?: number;
  last_selected_text?: string | null;
  is_finished?: boolean;
}

export interface VocabularyItem {
  id: string;
  user_id: string;
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  difficulty: "easy" | "medium" | "hard";
  lemma?: string;
  cefr_level?: VocabularyCefrLevel;
  synonyms?: string[];
  antonyms?: string[];
  word_family?: VocabularyWordFamilyItem[];
  collocations?: VocabularyCollocationItem[];
  tags?: string[];
  folder_name?: string;
  starred?: boolean;
  notes?: string;
  pronunciation?: string;
  last_source_name?: string;
  created_at: string;
  updated_at: string;
}

export interface VocabularyContext {
  id: string;
  vocabulary_item_id: string;
  article_id: string;
  original_sentence: string;
  contextual_meaning: string;
  context_explanation: string;
  created_at: string;
}

export interface ReviewState {
  id: string;
  user_id: string;
  vocabulary_item_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
  last_reviewed_at: string | null;
}

export interface ReviewEvent {
  id: string;
  user_id: string;
  vocabulary_item_id: string;
  rating: "again" | "easy" | "medium" | "hard";
  reviewed_at: string;
}

export type ThemeMode = "light" | "dark" | "system";
export type ReaderLookupStyle = "word" | "phrase";
export type LookupMode = "vocab" | "sentence" | "paragraph";
export type LookupIntent = "translate" | "explain";
export type IdiomDetectionType = "idiom" | "phrasal_verb";
export type UiLanguage = "en" | "th";
export type TapBehavior = "word" | "sentence" | "off";
export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type LearningGoal = "general" | "business" | "exam" | "travel" | "conversation";
export type PreferredAccent = "us" | "uk" | "au" | "any";
export type TranslationDensity = "minimal" | "balanced" | "full";
export type ArticleAiArtifactType = "chunked_html" | "idioms" | "article_guide";
export type VocabularyCefrLevel = EnglishLevel | "";

export interface VocabularyWordFamilyItem {
  word: string;
  part_of_speech?: string;
  thai_meaning?: string;
}

export interface VocabularyCollocationItem {
  phrase: string;
  thai_meaning?: string;
  example?: string;
}

export interface VocabularyEnrichment {
  lemma: string;
  cefr_level: VocabularyCefrLevel;
  synonyms: string[];
  antonyms: string[];
  word_family: VocabularyWordFamilyItem[];
  collocations: VocabularyCollocationItem[];
}

export interface UserSettings {
  id: string;
  user_id: string;
  theme: ThemeMode;
  font_size: number;
  line_spacing: number;
  review_goal?: number;
  enable_notifications?: boolean;
  reminder_hour?: number;
  onboarding_completed?: boolean;
  enable_offline?: boolean;
  reader_mode?: ReaderLookupStyle;
  default_lookup_intent?: LookupIntent;
  ui_language?: UiLanguage;
  tap_behavior?: TapBehavior;
  english_level?: EnglishLevel;
  learning_goal?: LearningGoal;
  preferred_accent?: PreferredAccent;
  daily_listening_goal_min?: number;
  translation_density?: TranslationDensity;
  updated_at: string;
}

export interface ArticleNote {
  id: string;
  user_id: string;
  article_id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
}

export interface ArticleQuiz {
  id: string;
  user_id: string;
  article_id: string;
  quiz: QuizQuestion[];
  created_at: string;
  updated_at: string;
}

export interface ArticleQuizAttemptAnswer {
  question_index: number;
  selected_option_index: number;
  correct_option_index: number;
  is_correct: boolean;
}

export interface ArticleQuizAttempt {
  id: string;
  user_id: string;
  article_id: string;
  article_quiz_id: string | null;
  score: number;
  total: number;
  answers: ArticleQuizAttemptAnswer[];
  completed_at: string;
}

export interface ArticleQuizAttemptInsert {
  user_id: string;
  article_id: string;
  article_quiz_id: string | null;
  score: number;
  total: number;
  answers: ArticleQuizAttemptAnswer[];
  completed_at?: string;
}

export interface ArticleGuideVocabularyItem {
  word: string;
  thai_meaning: string;
  simple_english_meaning: string;
}

export interface ArticleGuide {
  short_summary_th: string;
  why_it_matters_th: string;
  key_vocabulary: ArticleGuideVocabularyItem[];
  background_context_th: string;
  reading_goals: string[];
}

export interface ArticleVocabularySuggestion {
  word: string;
  lemma: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  cefr_level: VocabularyCefrLevel;
  difficulty: "easy" | "medium" | "hard";
  original_sentence: string;
  why_useful_th: string;
}

export interface ArticleAiArtifact {
  id: string;
  user_id: string;
  article_id: string;
  artifact_type: ArticleAiArtifactType;
  input_hash: string;
  model: string;
  payload: unknown;
  created_at: string;
  updated_at: string;
}

// API and UI types

export interface ExtractedArticle {
  url: string;
  title: string;
  description?: string;
  source_name: string;
  author: string | null;
  published_at: string | null;
  image_url: string | null;
  content: string;
}

export type NewsSection = "general" | "business" | "tech" | "science";

export interface NewsFeedItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source_name: string;
  published_at: string | null;
  image_url: string | null;
  category: NewsSection;
}

export interface NewsFeedResponse {
  section: NewsSection | "all";
  items: NewsFeedItem[];
  warnings?: string[];
}

export interface SavedVocabularyPreview {
  id: string;
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  difficulty: "easy" | "medium" | "hard";
  lemma?: string;
  cefr_level?: VocabularyCefrLevel;
  pronunciation?: string;
  last_source_name?: string;
}

export interface VocabularyLookupResult {
  type: "vocab";
  intent: "translate";
  text: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  contextual_meaning: string;
  context_explanation: string;
  difficulty: "easy" | "medium" | "hard";
  lemma?: string;
  cefr_level?: VocabularyCefrLevel;
  synonyms?: string[];
  antonyms?: string[];
  word_family?: VocabularyWordFamilyItem[];
  collocations?: VocabularyCollocationItem[];
}

export interface SentenceKeyPhrase {
  phrase: string;
  thai_meaning: string;
  explanation: string;
}

export interface SentenceTranslateResult {
  type: "sentence";
  intent: "translate";
  text: string;
  thai_translation: string;
  gist: string;
}

export interface SentenceExplainResult {
  type: "sentence";
  intent: "explain";
  text: string;
  thai_translation: string;
  gist: string;
  structure_note: string;
  key_phrases: SentenceKeyPhrase[];
}

export interface ParagraphTranslateResult {
  type: "paragraph";
  intent: "translate";
  text: string;
  thai_translation: string;
  gist: string;
}

export interface ParagraphExplainResult {
  type: "paragraph";
  intent: "explain";
  text: string;
  thai_translation: string;
  gist: string;
  key_points: string[];
  key_phrases: SentenceKeyPhrase[];
}

export interface SentenceAnalysisPart {
  part: string;
  text: string;
}

export interface SentenceAnalysisResult {
  translation: string;
  tense: string;
  structure: SentenceAnalysisPart[];
  explanation: string;
}

export interface ChunkedArticleResult {
  html: string;
}

export interface DetectedIdiom {
  phrase: string;
  meaning: string;
  type: IdiomDetectionType;
}

export type LookupResult =
  | VocabularyLookupResult
  | SentenceTranslateResult
  | SentenceExplainResult
  | ParagraphTranslateResult
  | ParagraphExplainResult;

export interface DashboardStats {
  dueCount: number;
  reviewGoal: number;
  reviewedToday: number;
  vocabCount: number;
  distinctArticleCount: number;
  streak: number;
  quizAttemptsCompleted?: number;
  averageQuizScorePercent?: number;
}
