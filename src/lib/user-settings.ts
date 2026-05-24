import type {
  EnglishLevel,
  LearningGoal,
  LookupIntent,
  PreferredAccent,
  ReaderLookupStyle,
  TapBehavior,
  ThemeMode,
  TranslationDensity,
  UiLanguage,
  UserSettings,
} from "@/types";

export interface SyncedUserSettings {
  theme: ThemeMode;
  fontSize: number;
  lineSpacing: number;
  readerMode: ReaderLookupStyle;
  defaultLookupIntent: LookupIntent;
  uiLanguage: UiLanguage;
  tapBehavior: TapBehavior;
  reviewGoal: number;
  enableNotifications: boolean;
  reminderHour: number;
  onboardingCompleted: boolean;
  enableOffline: boolean;
  englishLevel: EnglishLevel;
  learningGoal: LearningGoal;
  preferredAccent: PreferredAccent;
  dailyListeningGoalMin: number;
  translationDensity: TranslationDensity;
}

export const DEFAULT_USER_SETTINGS: SyncedUserSettings = {
  theme: "system",
  fontSize: 18,
  lineSpacing: 1.6,
  readerMode: "phrase",
  defaultLookupIntent: "translate",
  uiLanguage: "en",
  tapBehavior: "word",
  reviewGoal: 10,
  enableNotifications: false,
  reminderHour: 19,
  onboardingCompleted: false,
  enableOffline: true,
  englishLevel: "B1",
  learningGoal: "general",
  preferredAccent: "us",
  dailyListeningGoalMin: 10,
  translationDensity: "balanced",
};

export const USER_SETTINGS_SELECT =
  "theme, font_size, line_spacing, reader_mode, default_lookup_intent, ui_language, tap_behavior, review_goal, enable_notifications, reminder_hour, onboarding_completed, enable_offline, english_level, learning_goal, preferred_accent, daily_listening_goal_min, translation_density";

type NullableUserSettings = Partial<UserSettings> | null | undefined;

function normalizeTheme(value?: string | null): ThemeMode {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : DEFAULT_USER_SETTINGS.theme;
}

function normalizeReaderMode(value?: string | null): ReaderLookupStyle {
  return value === "word" ? "word" : DEFAULT_USER_SETTINGS.readerMode;
}

function normalizeLookupIntent(value?: string | null): LookupIntent {
  return value === "explain" ? "explain" : DEFAULT_USER_SETTINGS.defaultLookupIntent;
}

function normalizeUiLanguage(value?: string | null): UiLanguage {
  return value === "th" ? "th" : DEFAULT_USER_SETTINGS.uiLanguage;
}

function normalizeTapBehavior(value?: string | null): TapBehavior {
  if (value === "sentence" || value === "off") {
    return value;
  }

  return DEFAULT_USER_SETTINGS.tapBehavior;
}

function normalizeEnglishLevel(value?: string | null): EnglishLevel {
  return value === "A1" ||
    value === "A2" ||
    value === "B1" ||
    value === "B2" ||
    value === "C1" ||
    value === "C2"
    ? value
    : DEFAULT_USER_SETTINGS.englishLevel;
}

function normalizeLearningGoal(value?: string | null): LearningGoal {
  return value === "business" ||
    value === "exam" ||
    value === "travel" ||
    value === "conversation"
    ? value
    : DEFAULT_USER_SETTINGS.learningGoal;
}

function normalizePreferredAccent(value?: string | null): PreferredAccent {
  return value === "uk" || value === "au" || value === "any"
    ? value
    : DEFAULT_USER_SETTINGS.preferredAccent;
}

function normalizeTranslationDensity(value?: string | null): TranslationDensity {
  return value === "minimal" || value === "full"
    ? value
    : DEFAULT_USER_SETTINGS.translationDensity;
}

function normalizeFontSize(value?: number | null) {
  return typeof value === "number" && value >= 14 && value <= 28
    ? value
    : DEFAULT_USER_SETTINGS.fontSize;
}

function normalizeLineSpacing(value?: number | null) {
  return typeof value === "number" && value >= 1.2 && value <= 2.4
    ? value
    : DEFAULT_USER_SETTINGS.lineSpacing;
}

function normalizeReviewGoal(value?: number | null) {
  return typeof value === "number" && value >= 5 && value <= 50
    ? value
    : DEFAULT_USER_SETTINGS.reviewGoal;
}

function normalizeReminderHour(value?: number | null) {
  return typeof value === "number" && value >= 0 && value <= 23
    ? value
    : DEFAULT_USER_SETTINGS.reminderHour;
}

function normalizeDailyListeningGoal(value?: number | null) {
  return typeof value === "number" && value >= 0 && value <= 180
    ? value
    : DEFAULT_USER_SETTINGS.dailyListeningGoalMin;
}

export function coerceUserSettings(settings?: NullableUserSettings): SyncedUserSettings {
  return {
    theme: normalizeTheme(settings?.theme),
    fontSize: normalizeFontSize(settings?.font_size),
    lineSpacing: normalizeLineSpacing(settings?.line_spacing),
    readerMode: normalizeReaderMode(settings?.reader_mode),
    defaultLookupIntent: normalizeLookupIntent(settings?.default_lookup_intent),
    uiLanguage: normalizeUiLanguage(settings?.ui_language),
    tapBehavior: normalizeTapBehavior(settings?.tap_behavior),
    reviewGoal: normalizeReviewGoal(settings?.review_goal),
    enableNotifications:
      typeof settings?.enable_notifications === "boolean"
        ? settings.enable_notifications
        : DEFAULT_USER_SETTINGS.enableNotifications,
    reminderHour: normalizeReminderHour(settings?.reminder_hour),
    onboardingCompleted:
      typeof settings?.onboarding_completed === "boolean"
        ? settings.onboarding_completed
        : DEFAULT_USER_SETTINGS.onboardingCompleted,
    enableOffline:
      typeof settings?.enable_offline === "boolean"
        ? settings.enable_offline
        : DEFAULT_USER_SETTINGS.enableOffline,
    englishLevel: normalizeEnglishLevel(settings?.english_level),
    learningGoal: normalizeLearningGoal(settings?.learning_goal),
    preferredAccent: normalizePreferredAccent(settings?.preferred_accent),
    dailyListeningGoalMin: normalizeDailyListeningGoal(settings?.daily_listening_goal_min),
    translationDensity: normalizeTranslationDensity(settings?.translation_density),
  };
}

export function toUserSettingsUpdate(settings: Partial<SyncedUserSettings>) {
  const update: Record<string, unknown> = {};

  if (settings.theme) update.theme = settings.theme;
  if (typeof settings.fontSize === "number") update.font_size = settings.fontSize;
  if (typeof settings.lineSpacing === "number") update.line_spacing = settings.lineSpacing;
  if (settings.readerMode) update.reader_mode = settings.readerMode;
  if (settings.defaultLookupIntent) {
    update.default_lookup_intent = settings.defaultLookupIntent;
  }
  if (settings.uiLanguage) update.ui_language = settings.uiLanguage;
  if (settings.tapBehavior) update.tap_behavior = settings.tapBehavior;
  if (typeof settings.reviewGoal === "number") update.review_goal = settings.reviewGoal;
  if (typeof settings.enableNotifications === "boolean") {
    update.enable_notifications = settings.enableNotifications;
  }
  if (typeof settings.reminderHour === "number") update.reminder_hour = settings.reminderHour;
  if (typeof settings.onboardingCompleted === "boolean") {
    update.onboarding_completed = settings.onboardingCompleted;
  }
  if (typeof settings.enableOffline === "boolean") {
    update.enable_offline = settings.enableOffline;
  }
  if (settings.englishLevel) update.english_level = settings.englishLevel;
  if (settings.learningGoal) update.learning_goal = settings.learningGoal;
  if (settings.preferredAccent) update.preferred_accent = settings.preferredAccent;
  if (typeof settings.dailyListeningGoalMin === "number") {
    update.daily_listening_goal_min = settings.dailyListeningGoalMin;
  }
  if (settings.translationDensity) {
    update.translation_density = settings.translationDensity;
  }

  return update;
}
