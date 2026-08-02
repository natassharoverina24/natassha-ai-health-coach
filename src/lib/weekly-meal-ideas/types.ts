import type { MealSlot } from "@/lib/planner";

export type MealIdeaProvenance =
  | "local-catalog"
  | "user-history"
  | "ai-assisted";

export type MealIdeaProvider = "gemini" | "groq" | "openrouter";

export interface PracticalMealIdea {
  id: string;
  name: string;
  slots: MealSlot[];
  roles: ("protein" | "carb" | "vegetable-fiber" | "fruit-snack")[];
  ingredientIds: string[];
  availability: "common" | "optional";
  preparation: "quick" | "simple";
  reason: string;
  searchKeywords: string;
  provenance: MealIdeaProvenance;
  provider?: MealIdeaProvider;
  model?: string;
  nutritionStatus: "approved-template" | "needs-confirmation";
}

export interface WeeklyMealPreferences {
  likedFoodIds: string[];
  dislikedFoodIds: string[];
  quickMealsPreferred: boolean;
}

export interface RecipeLinkRecord {
  userId: string;
  date: string;
  slot: MealSlot;
  url: string;
  savedAt: string;
}

export type MealIdeaGenerationResult =
  | { status: "success"; idea: PracticalMealIdea }
  | { status: "local-fallback"; reason: "unconfigured" | "unavailable" }
  | { status: "invalid-input" };
