/**
 * Coach Layer — Weekly KPI
 * ---------------------------------------------------------------------------
 * "Best achievement" / "biggest challenge" are simply the highest- and
 * lowest-scoring dimensions from the week's adherence numbers.
 * "Improvement focus" is defined as exactly the same dimension as the
 * biggest challenge — the spec calls for "only ONE" focus area, so rather
 * than inventing a second ranking, this reuses the challenge dimension
 * under an action-oriented label. "Next week goal" is a template string
 * looked up by that same dimension — deterministic, not generated.
 */
import type { CoachDimension, KpiHighlight, KpiSummary, WeeklyAdherence } from "./types";

export const DIMENSION_LABELS: Record<CoachDimension, string> = {
  calories: "Calories",
  protein: "Protein",
  water: "Water",
  workout: "Workout",
  sleep: "Sleep",
  mealLogging: "Meal logging",
};

const NEXT_WEEK_GOAL_TEMPLATES: Record<CoachDimension, string> = {
  calories: "Stay within your calorie target on at least 5 days next week.",
  protein: "Hit your protein goal on at least 5 days next week.",
  water: "Reach your water goal every day next week.",
  workout: "Log a workout on at least 4 days next week.",
  sleep: "Get at least your sleep goal on 5 nights next week.",
  mealLogging: "Log all three main meals every day next week.",
};

export function computeWeeklyKpi(adherence: WeeklyAdherence): KpiSummary {
  const entries = Object.entries(adherence) as [CoachDimension, number][];
  if (entries.length === 0) {
    return { bestAchievement: null, biggestChallenge: null, improvementFocus: null, nextWeekGoal: null };
  }

  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const [bestDimension, bestPercent] = sorted[0];
  const [worstDimension, worstPercent] = sorted[sorted.length - 1];

  const bestAchievement: KpiHighlight = {
    dimension: bestDimension,
    label: DIMENSION_LABELS[bestDimension],
    percent: bestPercent,
  };
  const challenge: KpiHighlight = {
    dimension: worstDimension,
    label: DIMENSION_LABELS[worstDimension],
    percent: worstPercent,
  };

  return {
    bestAchievement,
    biggestChallenge: challenge,
    improvementFocus: challenge,
    nextWeekGoal: NEXT_WEEK_GOAL_TEMPLATES[worstDimension],
  };
}
