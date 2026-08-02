import type { WeeklyMealPreferences } from "./types";

const KEY = "natassha-weekly-meal-preferences-v1";
const EMPTY: WeeklyMealPreferences = { likedFoodIds: [], dislikedFoodIds: [], quickMealsPreferred: false };

export function readWeeklyMealPreferences(userId: string): WeeklyMealPreferences {
  if (typeof window === "undefined") return { ...EMPTY, likedFoodIds: [], dislikedFoodIds: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`${KEY}:${userId}`) ?? "null") as Partial<WeeklyMealPreferences> | null;
    return {
      likedFoodIds: Array.isArray(parsed?.likedFoodIds) ? parsed.likedFoodIds.filter((id): id is string => typeof id === "string") : [],
      dislikedFoodIds: Array.isArray(parsed?.dislikedFoodIds) ? parsed.dislikedFoodIds.filter((id): id is string => typeof id === "string") : [],
      quickMealsPreferred: parsed?.quickMealsPreferred === true,
    };
  } catch {
    return { ...EMPTY, likedFoodIds: [], dislikedFoodIds: [] };
  }
}

export function saveWeeklyMealPreferences(userId: string, preferences: WeeklyMealPreferences): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${KEY}:${userId}`, JSON.stringify(preferences));
}
