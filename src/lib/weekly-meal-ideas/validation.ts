import type { MealSlot } from "@/lib/planner";

import type { MealIdeaProvider, PracticalMealIdea } from "./types";

const ALLOWED_ROLES = new Set(["protein", "carb", "vegetable-fiber", "fruit-snack"]);
const FANCY_OR_HARD = /\b(foie gras|truffle|caviar|wagyu|lobster|saffron|sous vide)\b/i;
const UNSAFE = /\b(diagnos|cures?|treat|medication|supplement|thyroid diet|detox|skip (?:a )?meal|fasting|extreme restriction)\b/i;
const NUTRITION_KEYS = ["calories", "caloriesKcal", "protein", "proteinG", "carbs", "fat", "macros"];

function text(value: unknown, max = 160): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : null;
}

export function validateAiMealIdea(
  value: unknown,
  slot: MealSlot,
  provider: MealIdeaProvider,
  model: string,
  dislikedFoodIds: readonly string[] = [],
): PracticalMealIdea | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (NUTRITION_KEYS.some((key) => key in candidate)) return null;
  const name = text(candidate.name, 100);
  const reason = text(candidate.reason, 220);
  const searchKeywords = text(candidate.searchKeywords, 140);
  const ingredientIds = Array.isArray(candidate.ingredientIds)
    ? candidate.ingredientIds.map((item) => text(item, 60))
    : [];
  const roles = Array.isArray(candidate.roles)
    ? candidate.roles.map((item) => text(item, 40))
    : [];
  if (
    !name ||
    !reason ||
    !searchKeywords ||
    ingredientIds.length === 0 ||
    ingredientIds.some((item) => item === null) ||
    roles.length === 0 ||
    roles.some((role) => !role || !ALLOWED_ROLES.has(role)) ||
    FANCY_OR_HARD.test(name) ||
    UNSAFE.test(`${name} ${reason}`) ||
    ingredientIds.some((id) => id && dislikedFoodIds.includes(id))
  ) {
    return null;
  }
  const normalizedId = name.toLocaleLowerCase("id").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!normalizedId) return null;
  return {
    id: `ai-${provider}-${normalizedId}`,
    name,
    slots: [slot],
    roles: roles as PracticalMealIdea["roles"],
    ingredientIds: ingredientIds as string[],
    availability: candidate.availability === "optional" ? "optional" : "common",
    preparation: candidate.preparation === "simple" ? "simple" : "quick",
    reason,
    searchKeywords,
    provenance: "ai-assisted",
    provider,
    model,
    nutritionStatus: "needs-confirmation",
  };
}
