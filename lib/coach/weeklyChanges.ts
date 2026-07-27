/**
 * Coach Layer — Trailing Weekly Changes
 * ---------------------------------------------------------------------------
 * Chunks a date range into consecutive 7-day windows and computes the net
 * change of a metric (e.g. weight) across each window — the input the
 * Maintenance Engine's regain-detection rule needs (several trailing
 * weekly deltas, not just the latest one).
 */

/** Splits `dates` (oldest first) into consecutive 7-day chunks, oldest week first. Drops a trailing partial week. */
export function chunkDatesIntoWeeks(dates: string[]): string[][] {
  const weeks: string[][] = [];
  for (let i = 0; i + 7 <= dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }
  return weeks;
}

export function computeTrailingWeeklyChangesKg(
  entries: { date: string; weightKg: number }[],
  weekWindows: string[][],
): (number | null)[] {
  return weekWindows.map((weekDates) => {
    const inWeek = entries
      .filter((e) => weekDates.includes(e.date))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (inWeek.length < 2) return null;
    return inWeek[inWeek.length - 1].weightKg - inWeek[0].weightKg;
  });
}
