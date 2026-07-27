/**
 * Nutrition Engine
 * ---------------------------------------------------------------------------
 * Knowledge rules: protein first, structured meals, migraine-safe meal
 * timing, office schedule awareness.
 */
import type { DailyLogInputs, DailyGoals } from "@/lib/coach/types";
import type { EngineInsight } from "./types";

const PROTEIN_LOW_THRESHOLD_PERCENT = 70;
const MIGRAINE_SAFE_MAX_GAP_HOURS = 5;

export interface MealTimestamp {
  type: "breakfast" | "lunch" | "dinner" | "snack";
  loggedAt: string; // ISO datetime
}

export interface NutritionEngineInput {
  today: DailyLogInputs;
  goals: DailyGoals;
  /** Today's meal timestamps in the order logged, used to detect large gaps. */
  todaysMealTimestamps: MealTimestamp[];
  lunchProvidedByOffice: boolean;
  currentHour: number;
}

export function largestGapHours(timestamps: MealTimestamp[]): number {
  if (timestamps.length < 2) return 0;
  const sorted = [...timestamps].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
  );
  let maxGap = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const gapMs = new Date(sorted[i].loggedAt).getTime() - new Date(sorted[i - 1].loggedAt).getTime();
    maxGap = Math.max(maxGap, gapMs / (1000 * 60 * 60));
  }
  return maxGap;
}

export function runNutritionEngine(input: NutritionEngineInput): EngineInsight[] {
  const { today, goals, todaysMealTimestamps, lunchProvidedByOffice, currentHour } = input;
  const insights: EngineInsight[] = [];

  // --- protein first ---
  const proteinPercent = goals.proteinGoalG > 0 ? (today.proteinConsumedG / goals.proteinGoalG) * 100 : 0;
  if (currentHour >= 12 && proteinPercent < PROTEIN_LOW_THRESHOLD_PERCENT) {
    insights.push({
      id: "nutrition.protein_first",
      engine: "nutrition",
      priority: "medium",
      urgency: "soon",
      tone: "encouraging",
      summary: `Protein is at ${Math.round(proteinPercent)}% of today's goal.`,
      reason: "Protein is the macro most protective of muscle during weight loss and the most filling per calorie — it's the first thing worth fixing, not calories overall.",
      recommendedAction: `Make the next meal protein-forward (egg, chicken, fish, tofu, or tempe) to close the ${Math.round(goals.proteinGoalG - today.proteinConsumedG)}g gap.`,
      data: { proteinConsumedG: today.proteinConsumedG, proteinGoalG: goals.proteinGoalG },
    });
  }

  // --- structured meals / migraine-safe meal timing ---
  const gap = largestGapHours(todaysMealTimestamps);
  if (gap > MIGRAINE_SAFE_MAX_GAP_HOURS) {
    insights.push({
      id: "nutrition.meal_gap_too_long",
      engine: "nutrition",
      priority: "medium",
      urgency: "now",
      tone: "gentle",
      summary: `${gap.toFixed(1)} hours between meals today.`,
      reason: "Gaps beyond about 5 hours are a known migraine trigger and also tend to lead to lower-quality, rushed eating later.",
      recommendedAction: "Have a small structured snack now rather than waiting for the next full meal.",
      data: { largestGapHours: Number(gap.toFixed(1)), safeMaxGapHours: MIGRAINE_SAFE_MAX_GAP_HOURS },
    });
  } else if (todaysMealTimestamps.length === 0 && currentHour >= 10) {
    insights.push({
      id: "nutrition.no_meals_logged_yet",
      engine: "nutrition",
      priority: "medium",
      urgency: "soon",
      tone: "gentle",
      summary: "No meals logged yet today.",
      reason: "Structured, regularly-timed meals are easier to stay consistent with than skipping and compensating later.",
      recommendedAction: "Log breakfast (or brunch) now, even if it's already eaten — the record matters more than the timing.",
      data: { currentHour },
    });
  }

  // --- office schedule awareness ---
  const loggedLunch = todaysMealTimestamps.some((m) => m.type === "lunch");
  if (lunchProvidedByOffice && !loggedLunch && currentHour >= 13 && currentHour < 16) {
    insights.push({
      id: "nutrition.office_lunch_reminder",
      engine: "nutrition",
      priority: "low",
      urgency: "soon",
      tone: "neutral",
      summary: "Office lunch hasn't been logged yet.",
      reason: "Office-provided lunch is easy to forget to log precisely because it doesn't require any prep decision from you.",
      recommendedAction: "Use the Office Lunch quick-add on the Meal page to log what was on today's tray.",
      data: { currentHour },
    });
  }

  return insights;
}
