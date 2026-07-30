/**
 * Coach Layer — Daily Input Aggregation
 * ---------------------------------------------------------------------------
 * Bridges the repository layer's domain objects (MealEntry, WaterLogEntry,
 * etc.) to the scoring engine's plain DailyLogInputs shape. Kept as its own
 * pure function (no React, no Firestore calls — just array filtering) so
 * it's trivially unit-testable with plain fixture data.
 */
import type { MealEntry, SleepEntry, WaterLogEntry, WorkoutEntry } from "@/types/firestore";
import { hasConfirmedMealNutrition } from "@/lib/utils/nutritionEstimates";
import type { DailyLogInputs } from "./types";

export interface DailyInputSources {
  meals: MealEntry[];
  waterLogs: WaterLogEntry[];
  workouts: WorkoutEntry[];
  sleepLogs: SleepEntry[];
}

export function buildDailyLogInputs(dates: string[], sources: DailyInputSources): DailyLogInputs[] {
  return dates.map((date) => {
    const dayMeals = sources.meals.filter(
      (meal) => meal.date === date && hasConfirmedMealNutrition(meal),
    );
    const dayWater = sources.waterLogs.filter((entry) => entry.date === date);
    const dayWorkouts = sources.workouts.filter((entry) => entry.date === date);
    const daySleep = sources.sleepLogs.find((entry) => entry.date === date) ?? null;

    return {
      date,
      caloriesConsumed: dayMeals.reduce((sum, meal) => sum + meal.macros.calories, 0),
      proteinConsumedG: dayMeals.reduce((sum, meal) => sum + meal.macros.proteinG, 0),
      waterMl: dayWater.reduce((sum, entry) => sum + entry.amountMl, 0),
      workoutMinutes: dayWorkouts.reduce((sum, entry) => sum + entry.durationMin, 0),
      sleepHours: daySleep?.hoursSlept ?? null,
      mealTypesLogged: Array.from(new Set(dayMeals.map((meal) => meal.type))),
    };
  });
}
