/**
 * Pure date-string helpers for building the rolling 7/14-day windows the
 * Weekly Progress & Coach Dashboard operates on. Works entirely on
 * "YYYY-MM-DD" strings (matches every collection's `date` field) using UTC
 * internally so day-arithmetic never drifts across a local-timezone DST
 * boundary — see todayISODate() in lib/utils/format.ts for how those
 * strings are produced from "now" in the first place.
 */

export function addDaysToISODate(isoDate: string, deltaDays: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

/** Returns the last `n` dates ending at (and including) `endDateISO`, oldest first. */
export function getLastNDates(n: number, endDateISO: string): string[] {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    dates.push(addDaysToISODate(endDateISO, -i));
  }
  return dates;
}

export interface WeekWindow {
  /** This week: the 7 days ending on `endDateISO`, oldest first. */
  current: string[];
  /** The 7 days immediately before `current`, oldest first — used for trend comparison. */
  previous: string[];
}

export function getRollingWeekWindows(endDateISO: string): WeekWindow {
  const fourteenDays = getLastNDates(14, endDateISO);
  return {
    previous: fourteenDays.slice(0, 7),
    current: fourteenDays.slice(7),
  };
}
