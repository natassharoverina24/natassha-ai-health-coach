/**
 * Coach Layer — Scoring
 * ---------------------------------------------------------------------------
 * Every score here is a plain, explainable formula over logged data versus
 * a goal — no model, no inference, nothing probabilistic. Two scoring
 * shapes are used:
 *
 *  - "At least goal" (protein, water, workout, sleep): hitting or beating
 *    the goal is 100; falling short scores proportionally. More isn't
 *    penalized — extra protein or a longer workout is never a bad thing.
 *  - "Closeness to goal" (calories): both under- and over-shooting reduce
 *    the score, since calorie *targets* (for a weight goal) cut both ways.
 *
 * Meal logging is scored by how many of the three core meal types
 * (breakfast/lunch/dinner) were logged that day — a consistency signal
 * distinct from the macros themselves.
 */
import { clampPercent } from "@/lib/utils/format";
import type { MealType } from "@/types/firestore";
import type {
  DailyCoachScore,
  DailyGoals,
  DailyLogInputs,
  DimensionScores,
  TrendDirection,
  WeeklyAdherence,
} from "./types";

const CORE_MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner"];

function scoreAtLeastGoal(actual: number, goal: number): number {
  if (goal <= 0) return 0;
  return clampPercent((actual / goal) * 100);
}

function scoreCloseness(actual: number, goal: number): number {
  if (goal <= 0) return 0;
  const diffPercent = (Math.abs(actual - goal) / goal) * 100;
  return clampPercent(100 - diffPercent);
}

function scoreMealLogging(mealTypesLogged: MealType[]): number {
  const loggedCoreCount = CORE_MEAL_TYPES.filter((type) => mealTypesLogged.includes(type)).length;
  return clampPercent((loggedCoreCount / CORE_MEAL_TYPES.length) * 100);
}

export function computeDailyDimensionScores(
  input: DailyLogInputs,
  goals: DailyGoals,
): DimensionScores {
  return {
    calories: scoreCloseness(input.caloriesConsumed, goals.calorieGoal),
    protein: scoreAtLeastGoal(input.proteinConsumedG, goals.proteinGoalG),
    water: scoreAtLeastGoal(input.waterMl, goals.waterGoalMl),
    workout: scoreAtLeastGoal(input.workoutMinutes, goals.workoutGoalMinPerDay),
    sleep: input.sleepHours == null ? 0 : scoreAtLeastGoal(input.sleepHours, goals.sleepGoalHours),
    mealLogging: scoreMealLogging(input.mealTypesLogged),
  };
}

export function computeOverallScore(dimensions: DimensionScores): number {
  const values = Object.values(dimensions);
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function computeDailyCoachScore(input: DailyLogInputs, goals: DailyGoals): DailyCoachScore {
  const dimensions = computeDailyDimensionScores(input, goals);
  return { date: input.date, dimensions, overall: computeOverallScore(dimensions) };
}

export function computeDailyCoachScores(
  inputs: DailyLogInputs[],
  goals: DailyGoals,
): DailyCoachScore[] {
  return inputs.map((input) => computeDailyCoachScore(input, goals));
}

const EMPTY_ADHERENCE: WeeklyAdherence = {
  calories: 0,
  protein: 0,
  water: 0,
  workout: 0,
  sleep: 0,
  mealLogging: 0,
};

/** Per-dimension average across the given days — this doubles as both "weekly adherence %" and the Coach Score's own inputs. */
export function computeWeeklyAdherence(dailyScores: DailyCoachScore[]): WeeklyAdherence {
  if (dailyScores.length === 0) return EMPTY_ADHERENCE;

  const sums = dailyScores.reduce<DimensionScores>(
    (acc, day) => ({
      calories: acc.calories + day.dimensions.calories,
      protein: acc.protein + day.dimensions.protein,
      water: acc.water + day.dimensions.water,
      workout: acc.workout + day.dimensions.workout,
      sleep: acc.sleep + day.dimensions.sleep,
      mealLogging: acc.mealLogging + day.dimensions.mealLogging,
    }),
    { calories: 0, protein: 0, water: 0, workout: 0, sleep: 0, mealLogging: 0 },
  );

  const n = dailyScores.length;
  return {
    calories: Math.round(sums.calories / n),
    protein: Math.round(sums.protein / n),
    water: Math.round(sums.water / n),
    workout: Math.round(sums.workout / n),
    sleep: Math.round(sums.sleep / n),
    mealLogging: Math.round(sums.mealLogging / n),
  };
}

export function computeWeeklyAverageScore(dailyScores: DailyCoachScore[]): number {
  if (dailyScores.length === 0) return 0;
  return Math.round(dailyScores.reduce((sum, day) => sum + day.overall, 0) / dailyScores.length);
}

export function computeTrend(current: number, previous: number): TrendDirection {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}
