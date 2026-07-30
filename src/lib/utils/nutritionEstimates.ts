import type { MealEntry, MealMacro } from "@/types/firestore";

/**
 * Rough per-serving nutrition estimates for common Indonesian office-lunch
 * items and quick-log foods. These are starting points, not a food
 * database — every place that uses them lets the person edit the numbers
 * before saving (see OfficeLunchQuickForm and QuickLogEntryForm), which is
 * the whole point of "automatically estimate, allow manual editing."
 */
export interface FoodEstimate {
  key: string;
  label: string;
  /** Typical serving description shown alongside the label. */
  serving: string;
  macros: MealMacro;
}

export const OFFICE_LUNCH_ITEMS: FoodEstimate[] = [
  {
    key: "rice",
    label: "Rice",
    serving: "1 serving, ~150g",
    macros: { calories: 200, proteinG: 4, carbsG: 44, fatG: 0.4, fiberG: 0.6 },
  },
  {
    key: "chicken",
    label: "Chicken",
    serving: "1 serving, ~100g",
    macros: { calories: 220, proteinG: 26, carbsG: 0, fatG: 12, fiberG: 0 },
  },
  {
    key: "fish",
    label: "Fish",
    serving: "1 serving, ~100g",
    macros: { calories: 180, proteinG: 22, carbsG: 0, fatG: 9, fiberG: 0 },
  },
  {
    key: "egg",
    label: "Egg",
    serving: "1 boiled egg, ~50g",
    macros: { calories: 78, proteinG: 6, carbsG: 0.6, fatG: 5, fiberG: 0 },
  },
  {
    key: "tempe",
    label: "Tempe",
    serving: "1 serving, ~50g",
    macros: { calories: 150, proteinG: 9, carbsG: 8, fatG: 9, fiberG: 4 },
  },
  {
    key: "tofu",
    label: "Tofu",
    serving: "1 serving, ~100g",
    macros: { calories: 90, proteinG: 10, carbsG: 2, fatG: 5, fiberG: 1 },
  },
  {
    key: "vegetables",
    label: "Vegetables",
    serving: "1 serving, ~100g",
    macros: { calories: 60, proteinG: 2, carbsG: 8, fatG: 2, fiberG: 3 },
  },
  {
    key: "soup",
    label: "Soup",
    serving: "1 bowl, ~200ml",
    macros: { calories: 90, proteinG: 6, carbsG: 8, fatG: 3, fiberG: 1.5 },
  },
  {
    key: "fruit",
    label: "Fruit",
    serving: "1 serving, ~100g",
    macros: { calories: 60, proteinG: 0.5, carbsG: 15, fatG: 0.2, fiberG: 2 },
  },
  {
    key: "dessert",
    label: "Dessert",
    serving: "1 serving, ~80g",
    macros: { calories: 180, proteinG: 2, carbsG: 30, fatG: 6, fiberG: 1 },
  },
  {
    key: "sweet_drink",
    label: "Sweet Drink",
    serving: "1 glass, ~250ml",
    macros: { calories: 130, proteinG: 0, carbsG: 33, fatG: 0, fiberG: 0 },
  },
];

export function sumMacros(macrosList: MealMacro[]): MealMacro {
  return macrosList.reduce<MealMacro>(
    (total, m) => ({
      calories: total.calories + m.calories,
      proteinG: total.proteinG + m.proteinG,
      carbsG: total.carbsG + m.carbsG,
      fatG: total.fatG + m.fatG,
      fiberG: (total.fiberG ?? 0) + (m.fiberG ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  );
}

/**
 * Legacy meal documents with real positive calories remain confirmed.
 * An all-zero legacy document is unresolved and must not enter totals until
 * the person confirms nutrition values.
 */
export function hasConfirmedMealNutrition(
  meal: Pick<MealEntry, "macros" | "nutritionConfirmation">,
): boolean {
  const { macros } = meal;
  const numbers = [
    macros.calories,
    macros.proteinG,
    macros.carbsG,
    macros.fatG,
  ];
  return (
    numbers.every((value) => Number.isFinite(value) && value >= 0) &&
    macros.calories > 0 &&
    (meal.nutritionConfirmation === undefined ||
      (meal.nutritionConfirmation.status === "confirmed" &&
        meal.nutritionConfirmation.userConfirmed === true))
  );
}

/** Quick-log food items — a curated subset of common everyday foods, not tied to office lunch. */
export const QUICK_LOG_FOODS: FoodEstimate[] = [
  {
    key: "coffee_milk",
    label: "Coffee with Milk",
    serving: "1 cup, ~200ml",
    macros: { calories: 70, proteinG: 2, carbsG: 9, fatG: 3, fiberG: 0 },
  },
  OFFICE_LUNCH_ITEMS.find((i) => i.key === "rice")!,
  OFFICE_LUNCH_ITEMS.find((i) => i.key === "chicken")!,
  OFFICE_LUNCH_ITEMS.find((i) => i.key === "egg")!,
  OFFICE_LUNCH_ITEMS.find((i) => i.key === "vegetables")!,
  OFFICE_LUNCH_ITEMS.find((i) => i.key === "fruit")!,
];

export const WATER_QUICK_AMOUNTS_ML = [250, 500, 750, 1000] as const;
