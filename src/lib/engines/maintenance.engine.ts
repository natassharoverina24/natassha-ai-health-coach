/**
 * Maintenance Engine
 * ---------------------------------------------------------------------------
 * Knowledge rules: weekly trend analysis, regain detection, maintenance
 * mode, extended care. Operates on trailing weekly weight-change figures
 * (already computed by src/lib/coach's weekly review) rather than raw
 * daily weights — weight fluctuates too much day to day to reason about
 * directly.
 */
import type { EngineInsight } from "./types";

const NEAR_GOAL_THRESHOLD_KG = 1;
const REGAIN_THRESHOLD_KG = 1;
const EXTENDED_CARE_CONSECUTIVE_REGAIN_WEEKS = 2;

export interface MaintenanceEngineInput {
  currentWeightKg: number;
  goalWeightKg: number;
  /** Net weight change for the most recent week (negative = loss), or null if not enough data. */
  latestWeeklyChangeKg: number | null;
  /** Net weight change per trailing week, most recent last (e.g. last 3-4 weeks). */
  recentWeeklyChangesKg: number[];
}

export function runMaintenanceEngine(input: MaintenanceEngineInput): EngineInsight[] {
  const { currentWeightKg, goalWeightKg, latestWeeklyChangeKg, recentWeeklyChangesKg } = input;
  const insights: EngineInsight[] = [];

  const nearGoal = Math.abs(currentWeightKg - goalWeightKg) <= NEAR_GOAL_THRESHOLD_KG;
  const isFlatTrend = latestWeeklyChangeKg != null && Math.abs(latestWeeklyChangeKg) < 0.3;

  // --- maintenance mode ---
  if (nearGoal && isFlatTrend) {
    insights.push({
      id: "maintenance.maintenance_mode",
      engine: "maintenance",
      priority: "low",
      urgency: "none",
      tone: "celebratory",
      summary: `Weight is holding steady near the goal of ${goalWeightKg} kg.`,
      reason: "Being within a kilogram of goal with a flat weekly trend means the target has effectively been reached and sustained — a different phase than active loss.",
      recommendedAction: "Shift focus from deficit-driven tracking to sustaining current habits — this is maintenance, not a plateau to break.",
      data: { currentWeightKg, goalWeightKg, latestWeeklyChangeKg: latestWeeklyChangeKg ?? 0 },
    });
    return insights;
  }

  // --- weekly trend analysis (always surfaced at low priority when there's data) ---
  if (latestWeeklyChangeKg != null) {
    insights.push({
      id: "maintenance.weekly_trend",
      engine: "maintenance",
      priority: "low",
      urgency: "none",
      tone: "neutral",
      summary:
        latestWeeklyChangeKg < 0
          ? `Down ${Math.abs(latestWeeklyChangeKg).toFixed(1)} kg this week.`
          : latestWeeklyChangeKg > 0
            ? `Up ${latestWeeklyChangeKg.toFixed(1)} kg this week.`
            : "Weight unchanged this week.",
      reason: "The weekly trend, not any single day's number, is what reflects real progress — daily weight is noisy with water and food volume.",
      recommendedAction: "Keep judging progress by the weekly trend rather than day-to-day fluctuations.",
      data: { latestWeeklyChangeKg },
    });
  }

  // --- regain detection ---
  const consecutiveRegainWeeks = countTrailingRegainWeeks(recentWeeklyChangesKg, REGAIN_THRESHOLD_KG);
  if (consecutiveRegainWeeks >= EXTENDED_CARE_CONSECUTIVE_REGAIN_WEEKS) {
    insights.push({
      id: "maintenance.extended_care",
      engine: "maintenance",
      priority: "high",
      urgency: "soon",
      tone: "concerned",
      summary: `Weight has trended up for ${consecutiveRegainWeeks} weeks in a row.`,
      reason: "A sustained multi-week upward trend (not one bad week) is the signal worth acting on directly rather than waiting out.",
      recommendedAction: "Revisit the basics this week — meal logging consistency and protein intake — rather than making a drastic change; consider a check-in with a professional if the trend continues.",
      data: { consecutiveRegainWeeks },
    });
  } else if (consecutiveRegainWeeks === 1) {
    insights.push({
      id: "maintenance.regain_watch",
      engine: "maintenance",
      priority: "medium",
      urgency: "soon",
      tone: "gentle",
      summary: "Weight trended up slightly this week.",
      reason: "One week up is common and not yet a pattern, but worth a light course-correction before it becomes one.",
      recommendedAction: "No need to panic — just tighten up meal logging this week and see if the trend self-corrects.",
      data: { consecutiveRegainWeeks },
    });
  }

  return insights;
}

function countTrailingRegainWeeks(weeklyChangesKg: number[], threshold: number): number {
  let count = 0;
  for (let i = weeklyChangesKg.length - 1; i >= 0; i -= 1) {
    if (weeklyChangesKg[i] >= threshold * 0.3 && weeklyChangesKg[i] > 0) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}
