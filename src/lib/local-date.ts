function padDatePart(value: number) {
  return value.toString().padStart(2, "0");
}

export function getLocalDateKey(date?: Date | string) {
  const value = date ? new Date(date) : new Date();

  return [
    value.getFullYear(),
    padDatePart(value.getMonth() + 1),
    padDatePart(value.getDate()),
  ].join("-");
}

export function getStartOfLocalToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export function calculateLocalDayStreak(reviewedAt: string[]) {
  const uniqueDays = [...new Set(reviewedAt.map((value) => getLocalDateKey(value)))].sort(
    (a, b) => b.localeCompare(a)
  );

  if (uniqueDays.length === 0) return 0;

  let streak = 0;
  const cursor = getStartOfLocalToday();

  for (const day of uniqueDays) {
    const expected = getLocalDateKey(cursor);
    if (day !== expected) {
      if (streak === 0) {
        cursor.setDate(cursor.getDate() - 1);
        if (day !== getLocalDateKey(cursor)) {
          break;
        }
      } else {
        break;
      }
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
