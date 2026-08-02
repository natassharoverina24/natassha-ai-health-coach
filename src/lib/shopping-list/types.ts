import type { MealSlot, WeeklyMealPrepDay } from "@/lib/planner";
import type { PracticalFoodRole } from "@/lib/meal-substitutions";

export type ShoppingListCategory =
  | "protein"
  | "carbohydrate"
  | "vegetable-fiber"
  | "fruit-snack"
  | "drink"
  | "pantry-basic";

export type ShoppingListProvenance =
  | "meal-template"
  | "selected-replacement"
  | "needs-confirmation"
  | "mixed";

export interface ShoppingListSource {
  date: string;
  slot: MealSlot;
  templateId: string;
  mealName: string;
  selectedReplacement: boolean;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  category: ShoppingListCategory;
  estimatedQuantity: number | null;
  unit: string | null;
  quantityStatus: "estimated" | "needs-confirmation";
  provenance: ShoppingListProvenance;
  sourceLabel: string;
  sourceMeals: ShoppingListSource[];
  checked: boolean;
}

export interface ShoppingBatchOpportunity {
  id: string;
  name: string;
  category: "protein" | "carbohydrate" | "pantry-basic";
  estimatedQuantity: number;
  unit: string;
  occurrenceCount: number;
  sourceMeals: ShoppingListSource[];
}

export interface SelectedMealReplacement {
  userId: string;
  date: string;
  slot: MealSlot;
  templateId: string;
  label: string;
  selectedAt: string;
  ingredientIds?: string[];
  provenance?: "local-catalog" | "ai-assisted" | "user-history";
  provider?: "gemini" | "groq" | "openrouter";
  model?: string;
}

export interface BuildShoppingListInput {
  days: readonly WeeklyMealPrepDay[];
  selectedReplacements?: readonly SelectedMealReplacement[];
}

export type ShoppingListResult =
  | { status: "empty"; items: []; warnings: string[] }
  | {
      status: "ready" | "partial";
      items: ShoppingListItem[];
      warnings: string[];
    };

export function shoppingCategoryFromRole(
  role: PracticalFoodRole,
): ShoppingListCategory {
  switch (role) {
    case "protein":
      return "protein";
    case "carb":
      return "carbohydrate";
    case "vegetable-fiber":
      return "vegetable-fiber";
    case "fruit-snack":
      return "fruit-snack";
    case "drink":
      return "drink";
  }
}
