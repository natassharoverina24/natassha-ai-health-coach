/**
 * Coach Layer — Weekly Summary Orchestration
 * ---------------------------------------------------------------------------
 * Thin composition over scoring.ts: turns a week (or two, for trend
 * comparison) of DailyLogInputs into the two top-level shapes the
 * dashboard renders directly.
 */
import { computeDailyCoachScores, computeTrend, computeWeeklyAdherence, computeWeeklyAverageScore } from "./scoring";
import type { CoachScoreSummary, DailyGoals, DailyLogInputs, WeeklyReview } from "./types";

function computeNetChange<T extends { date: string }>(
  entries: T[],
  selector: (entry: T) => number,
): number | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return selector(sorted[sorted.length - 1]) - selector(sorted[0]);
}

export function computeWeeklyReview(
  currentWeekInputs: DailyLogInputs[],
  goals: DailyGoals,
  weightsInWeek: { date: string; weightKg: number }[],
  waistsInWeek: { date: string; waistCm: number }[],
): WeeklyReview {
  const dailyScores = computeDailyCoachScores(currentWeekInputs, goals);
  return {
    weightChangeKg: computeNetChange(weightsInWeek, (w) => w.weightKg),
    waistChangeCm: computeNetChange(waistsInWeek, (w) => w.waistCm),
    adherence: computeWeeklyAdherence(dailyScores),
  };
}

export function computeCoachScoreSummary(
  currentWeekInputs: DailyLogInputs[],
  previousWeekInputs: DailyLogInputs[],
  goals: DailyGoals,
): CoachScoreSummary {
  const currentDailyScores = computeDailyCoachScores(currentWeekInputs, goals);
  const previousDailyScores = computeDailyCoachScores(previousWeekInputs, goals);

  const weeklyAverage = computeWeeklyAverageScore(currentDailyScores);
  const previousWeeklyAverage = computeWeeklyAverageScore(previousDailyScores);

  return {
    currentScore:
      currentDailyScores.length > 0 ? currentDailyScores[currentDailyScores.length - 1].overall : null,
    weeklyAverage,
    previousWeeklyAverage,
    trend: computeTrend(weeklyAverage, previousWeeklyAverage),
    dailyScores: currentDailyScores,
  };
}
