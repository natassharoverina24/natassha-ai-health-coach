/**
 * Coach Layer — Types
 * ---------------------------------------------------------------------------
 * Deterministic, rule-based scoring for the Weekly Progress & Coach
 * Dashboard (Phase 2C). Nothing in `src/lib/coach` is AI — it's plain
 * arithmetic over logged data, and it's intentionally kept separate from
 * `src/lib/ai` (still a stub) so that when the AI Coach is implemented, it
 * can *consume* these same computed scores/summaries as structured input
 * (via the context builder) rather than reimplementing this math itself.
 */
import type { MealType } from "@/types/firestore";

export interface DailyLogInputs {
  date: string; // "YYYY-MM-DD"
  caloriesConsumed: number;
  proteinConsumedG: number;
  waterMl: number;
  workoutMinutes: number;
  /** null = no sleep entry logged that day, distinct from "slept 0 hours". */
  sleepHours: number | null;
  mealTypesLogged: MealType[];
}

export interface DailyGoals {
  calorieGoal: number;
  proteinGoalG: number;
  waterGoalMl: number;
  workoutGoalMinPerDay: number;
  sleepGoalHours: number;
}

export type CoachDimension = "calories" | "protein" | "water" | "workout" | "sleep" | "mealLogging";

export interface DimensionScores {
  calories: number;
  protein: number;
  water: number;
  workout: number;
  sleep: number;
  mealLogging: number;
}

export interface DailyCoachScore {
  date: string;
  dimensions: DimensionScores;
  /** 0-100, the simple average of the six dimension scores. */
  overall: number;
}

export type WeeklyAdherence = DimensionScores;

export interface WeeklyReview {
  weightChangeKg: number | null;
  waistChangeCm: number | null;
  adherence: WeeklyAdherence;
}

export type TrendDirection = "up" | "down" | "flat";

export interface CoachScoreSummary {
  /** The most recent day's score, or null if no data has been logged yet. */
  currentScore: number | null;
  weeklyAverage: number;
  previousWeeklyAverage: number;
  trend: TrendDirection;
  dailyScores: DailyCoachScore[];
}

export interface KpiHighlight {
  dimension: CoachDimension;
  label: string;
  percent: number;
}

export interface KpiSummary {
  bestAchievement: KpiHighlight | null;
  biggestChallenge: KpiHighlight | null;
  /** Always the same single dimension as biggestChallenge — "only ONE" per spec. */
  improvementFocus: KpiHighlight | null;
  nextWeekGoal: string | null;
}

export type MilestoneCategory = "weight" | "streak" | "workout";

export interface Milestone {
  id: string;
  category: MilestoneCategory;
  title: string;
  description: string;
  /** Best-effort ISO date the milestone was reached. */
  achievedDate: string;
}
