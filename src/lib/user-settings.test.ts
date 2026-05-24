import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_USER_SETTINGS,
  USER_SETTINGS_SELECT,
  coerceUserSettings,
  toUserSettingsUpdate,
} from "./user-settings";
import type { UserSettings } from "@/types";

test("learning profile settings have safe defaults", () => {
  const settings = coerceUserSettings(null);

  assert.equal(settings.englishLevel, "B1");
  assert.equal(settings.learningGoal, "general");
  assert.equal(settings.preferredAccent, "us");
  assert.equal(settings.dailyListeningGoalMin, 10);
  assert.equal(settings.translationDensity, "balanced");
  assert.equal(DEFAULT_USER_SETTINGS.englishLevel, "B1");
});

test("learning profile settings coerce invalid database values", () => {
  const settings = coerceUserSettings({
    english_level: "native",
    learning_goal: "music",
    preferred_accent: "ca",
    daily_listening_goal_min: -5,
    translation_density: "everything",
  } as unknown as Partial<UserSettings>);

  assert.equal(settings.englishLevel, "B1");
  assert.equal(settings.learningGoal, "general");
  assert.equal(settings.preferredAccent, "us");
  assert.equal(settings.dailyListeningGoalMin, 10);
  assert.equal(settings.translationDensity, "balanced");
});

test("learning profile settings map to database column updates", () => {
  assert.deepEqual(
    toUserSettingsUpdate({
      englishLevel: "B2",
      learningGoal: "business",
      preferredAccent: "uk",
      dailyListeningGoalMin: 20,
      translationDensity: "minimal",
    }),
    {
      english_level: "B2",
      learning_goal: "business",
      preferred_accent: "uk",
      daily_listening_goal_min: 20,
      translation_density: "minimal",
    }
  );

  assert.match(USER_SETTINGS_SELECT, /english_level/);
  assert.match(USER_SETTINGS_SELECT, /learning_goal/);
  assert.match(USER_SETTINGS_SELECT, /preferred_accent/);
  assert.match(USER_SETTINGS_SELECT, /daily_listening_goal_min/);
  assert.match(USER_SETTINGS_SELECT, /translation_density/);
});
