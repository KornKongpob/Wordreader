import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateLocalDayStreak,
  getLocalDateKey,
  getStartOfLocalToday,
} from "./local-date";

test("getLocalDateKey formats the runtime local calendar day", () => {
  const localDate = new Date(2026, 0, 2, 0, 30, 0);

  assert.equal(getLocalDateKey(localDate), "2026-01-02");
});

test("getStartOfLocalToday returns local midnight", () => {
  const start = getStartOfLocalToday();

  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(start.getSeconds(), 0);
  assert.equal(start.getMilliseconds(), 0);
});

test("calculateLocalDayStreak groups review events by local date", () => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const reviewedAt = [
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 15).toISOString(),
    new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 50).toISOString(),
    new Date(twoDaysAgo.getFullYear(), twoDaysAgo.getMonth(), twoDaysAgo.getDate(), 12, 0).toISOString(),
  ];

  assert.equal(calculateLocalDayStreak(reviewedAt), 3);
});
