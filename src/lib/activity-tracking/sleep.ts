import type { SleepDurationResult } from "./types";

const CLOCK_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function clockMinutes(clock: string): number | null {
  if (!CLOCK_PATTERN.test(clock)) return null;
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}

export function calculateSleepDuration(
  sleepAt: string,
  wakeAt: string,
): SleepDurationResult {
  const start = clockMinutes(sleepAt);
  const end = clockMinutes(wakeAt);
  if (start === null || end === null) {
    return { status: "invalid-input", reason: "invalid-clock" };
  }
  if (start === end) {
    return { status: "invalid-input", reason: "same-time" };
  }
  const durationMinutes = end > start ? end - start : 24 * 60 - start + end;
  return {
    status: "success",
    durationMinutes,
    hoursSlept: Math.round((durationMinutes / 60) * 100) / 100,
  };
}

export function formatSleepDuration(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return minutes === 0 ? `${hours} jam` : `${hours} jam ${minutes} menit`;
}

export function buildSleepInsight(durationMinutes: number): string[] {
  const insight = [`Tidurmu sekitar ${formatSleepDuration(durationMinutes)}.`];
  if (durationMinutes < 7 * 60) {
    insight.push("Kalau hari ini capek, plan-nya kita bikin lebih realistis ya 💗");
  }
  return insight;
}
