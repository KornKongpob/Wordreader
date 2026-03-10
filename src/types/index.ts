// ─── Database row types ───

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

export interface UserSettings {
  id: string;
  user_id: string;
  theme: "light" | "dark" | "system";
  font_size: number;
  line_spacing: number;
  review_goal?: number;
  enable_notifications?: boolean;
  reminder_hour?: number;
  onboarding_completed?: boolean;
  enable_offline?: boolean;
  reader_mode?: "word" | "phrase";
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

// ─── API types ───

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

export interface TranslationResult {
  word: string;
  thai_meaning: string;
  english_meaning: string;
  part_of_speech: string;
  contextual_meaning: string;
  context_explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface DashboardStats {
  dueCount: number;
  reviewGoal: number;
  reviewedToday: number;
  vocabCount: number;
  distinctArticleCount: number;
  streak: number;
}
