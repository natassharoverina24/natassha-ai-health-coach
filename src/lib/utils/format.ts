/**
 * Formatting helpers shared across dashboard cards, charts, and pages.
 * Pure functions only — no React, no I/O — so they're trivially unit-testable.
 */

export function formatWeightKg(kg: number, fractionDigits = 1): string {
  return `${kg.toFixed(fractionDigits)} kg`;
}

export function formatSignedDelta(value: number, unit: string, fractionDigits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(fractionDigits)} ${unit}`;
}

export function formatDelta(deltaKg: number, fractionDigits = 1): string {
  return formatSignedDelta(deltaKg, "kg", fractionDigits);
}

export function formatCalories(kcal: number): string {
  return `${Math.round(kcal).toLocaleString("id-ID")} kcal`;
}

export function formatGrams(grams: number): string {
  return `${Math.round(grams)} g`;
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatMilliliters(ml: number): string {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1)} L`;
  return `${ml} ml`;
}

export function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** "2026-07-25" -> "25 Jul 2026" (Indonesian-friendly, unambiguous day-month-year). */
export function formatDateLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Returns today's date as "YYYY-MM-DD" in the local timezone. */
export function todayISODate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function greetingForHour(hour: number): string {
  if (hour < 11) return "Good morning";
  if (hour < 15) return "Good afternoon";
  if (hour < 19) return "Good evening";
  return "Good night";
}

/** ISO timestamp -> "8:32 AM" (locale-aware, used by Meal Detail's Time field). */
export function formatTimeLabel(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return isoDateTime;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Infers the most likely meal type for a quick-log entry from the hour of day. */
export function inferMealTypeForHour(hour: number): "breakfast" | "lunch" | "dinner" | "snack" {
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}
