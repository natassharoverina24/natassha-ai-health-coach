import {
  getTemplatePracticalFoods,
  PRACTICAL_FOOD_CATALOGUE,
} from "@/lib/meal-substitutions";
import type { MealSlot } from "@/lib/planner";

import {
  shoppingCategoryFromRole,
  type BuildShoppingListInput,
  type SelectedMealReplacement,
  type ShoppingListItem,
  type ShoppingBatchOpportunity,
  type ShoppingListProvenance,
  type ShoppingListResult,
  type ShoppingListSource,
} from "./types";

const SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];
const CATEGORY_ORDER = {
  protein: 0,
  carbohydrate: 1,
  "vegetable-fiber": 2,
  "fruit-snack": 3,
  drink: 4,
  "pantry-basic": 5,
} as const;

function replacementFor(
  replacements: readonly SelectedMealReplacement[],
  date: string,
  slot: MealSlot,
): SelectedMealReplacement | undefined {
  return replacements.find(
    (replacement) => replacement.date === date && replacement.slot === slot,
  );
}

function sourceLabel(provenance: ShoppingListProvenance): string {
  switch (provenance) {
    case "meal-template":
      return "Dari meal plan lokal";
    case "selected-replacement":
      return "Dari menu pengganti pilihanmu";
    case "needs-confirmation":
      return "Butuh konfirmasi manual";
    case "mixed":
      return "Dari meal plan dan pilihanmu";
  }
}

function mergedProvenance(
  left: ShoppingListProvenance,
  right: ShoppingListProvenance,
): ShoppingListProvenance {
  return left === right ? left : "mixed";
}

function sourceKey(source: ShoppingListSource): string {
  return `${source.date}:${source.slot}:${source.templateId}`;
}

export function mergeShoppingItems(
  items: readonly ShoppingListItem[],
): ShoppingListItem[] {
  const merged = new Map<string, ShoppingListItem>();
  for (const item of items) {
    const key = `${item.id}\u0000${item.unit ?? "manual"}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {
        ...item,
        sourceMeals: item.sourceMeals.map((source) => ({ ...source })),
      });
      continue;
    }

    current.estimatedQuantity =
      current.estimatedQuantity === null || item.estimatedQuantity === null
        ? null
        : current.estimatedQuantity + item.estimatedQuantity;
    current.quantityStatus =
      current.estimatedQuantity === null ? "needs-confirmation" : "estimated";
    current.provenance = mergedProvenance(
      current.provenance,
      item.provenance,
    );
    current.sourceLabel = sourceLabel(current.provenance);
    const knownSources = new Set(current.sourceMeals.map(sourceKey));
    for (const source of item.sourceMeals) {
      if (!knownSources.has(sourceKey(source))) {
        current.sourceMeals.push({ ...source });
        knownSources.add(sourceKey(source));
      }
    }
  }

  return [...merged.values()].sort(
    (left, right) =>
      CATEGORY_ORDER[left.category] - CATEGORY_ORDER[right.category] ||
      left.name.localeCompare(right.name, "id"),
  );
}

function manualItem(
  replacement: SelectedMealReplacement | undefined,
  source: ShoppingListSource,
): ShoppingListItem {
  const label = replacement?.label.trim() || source.mealName;
  const normalized = label.toLocaleLowerCase("id").replace(/[^a-z0-9]+/g, "-");
  return {
    id: `manual-${normalized || source.templateId}`,
    name: label,
    category: "pantry-basic",
    estimatedQuantity: null,
    unit: null,
    quantityStatus: "needs-confirmation",
    provenance: "needs-confirmation",
    sourceLabel: sourceLabel("needs-confirmation"),
    sourceMeals: [source],
    checked: false,
  };
}

export function estimateShoppingQuantity(): {
  quantity: number;
  unit: "porsi";
} {
  return { quantity: 1, unit: "porsi" };
}

export function buildBatchCookingOpportunities(
  items: readonly ShoppingListItem[],
): ShoppingBatchOpportunity[] {
  return items.flatMap((item) => {
    if (
      item.estimatedQuantity === null ||
      item.unit === null ||
      item.sourceMeals.length < 2 ||
      (item.category !== "protein" &&
        item.category !== "carbohydrate" &&
        item.category !== "pantry-basic")
    ) {
      return [];
    }

    return [
      {
        id: item.id,
        name: item.name,
        category: item.category,
        estimatedQuantity: item.estimatedQuantity,
        unit: item.unit,
        occurrenceCount: item.sourceMeals.length,
        sourceMeals: item.sourceMeals.map((source) => ({ ...source })),
      },
    ];
  });
}

export function buildShoppingListFromMealPlan({
  days,
  selectedReplacements = [],
}: BuildShoppingListInput): ShoppingListResult {
  if (days.length === 0) return { status: "empty", items: [], warnings: [] };

  const candidates: ShoppingListItem[] = [];
  let hasUnknown = false;

  for (const day of days) {
    for (const slot of SLOTS) {
      const planned = day.mealPlan[slot].template;
      const replacement = replacementFor(selectedReplacements, day.date, slot);
      const templateId = replacement?.templateId ?? planned.id;
      const mealName = replacement?.label ?? planned.name;
      const source: ShoppingListSource = {
        date: day.date,
        slot,
        templateId,
        mealName,
        selectedReplacement: Boolean(replacement),
      };
      const mappedReplacementFoods = replacement?.ingredientIds?.flatMap(
        (ingredientId) => {
          const item = PRACTICAL_FOOD_CATALOGUE.find(
            (candidate) => candidate.id === ingredientId,
          );
          return item ? [item] : [];
        },
      );
      const unknownReplacementIngredients = replacement?.ingredientIds?.filter(
        (ingredientId) =>
          !PRACTICAL_FOOD_CATALOGUE.some(
            (candidate) => candidate.id === ingredientId,
          ),
      ) ?? [];
      const foods = mappedReplacementFoods?.length
        ? mappedReplacementFoods
        : getTemplatePracticalFoods(templateId);

      if (foods.length === 0) {
        hasUnknown = true;
        candidates.push(manualItem(replacement, source));
        continue;
      }

      for (const ingredientId of unknownReplacementIngredients) {
        hasUnknown = true;
        candidates.push(
          manualItem(
            { ...replacement!, label: ingredientId },
            { ...source, mealName: ingredientId },
          ),
        );
      }

      const estimate = estimateShoppingQuantity();
      for (const food of foods) {
        const provenance: ShoppingListProvenance = replacement
          ? "selected-replacement"
          : "meal-template";
        candidates.push({
          id: food.id,
          name: food.label,
          category: shoppingCategoryFromRole(food.role),
          estimatedQuantity: estimate.quantity,
          unit: estimate.unit,
          quantityStatus: "estimated",
          provenance,
          sourceLabel: sourceLabel(provenance),
          sourceMeals: [source],
          checked: false,
        });
      }
    }
  }

  const items = mergeShoppingItems(candidates);
  return {
    status: hasUnknown ? "partial" : "ready",
    items,
    warnings: hasUnknown
      ? ["Beberapa item masih butuh konfirmasi manual."]
      : [],
  };
}
