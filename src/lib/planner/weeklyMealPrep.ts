import type { CoachDecision } from "@/lib/engines/decisionEngine";
import {
  rankMealCandidates,
  type MealPlan,
  type MealRecommendation,
  type RankedMealCandidate,
} from "./mealPlanner";
import type { MealSlot } from "./mealTemplates";
import type { PlannerUserContext } from "./plannerTypes";

export type ShoppingCategory =
  | "protein"
  | "vegetables"
  | "fruit"
  | "healthy_snacks"
  | "staples";

export interface ApprovedIngredientEntry {
  id: string;
  label: string;
  category: ShoppingCategory;
  quantity: number;
  unit: string;
  catalogueOrder: number;
}

export type ApprovedIngredientCatalogue = Readonly<
  Record<string, readonly ApprovedIngredientEntry[]>
>;

export interface WeeklyMealPrepInput {
  decision: CoachDecision;
  context: PlannerUserContext;
  officeLunchByDate: Readonly<Record<string, boolean>>;
  ingredientCatalogue: ApprovedIngredientCatalogue;
}

export interface WeeklyMealPrepDay {
  date: string;
  officeLunchProvided: boolean;
  mealPlan: MealPlan;
}

export interface WeeklyShoppingItem extends ApprovedIngredientEntry {
  occurrenceCount: number;
  occurrenceDates: string[];
}

export interface BatchCookingOpportunity {
  ingredientId: string;
  label: string;
  category: "protein" | "staples";
  quantity: number;
  unit: string;
  catalogueOrder: number;
  occurrenceCount: number;
  occurrenceDates: string[];
}

export type WeeklyMealPrepError =
  | { code: "invalid-start-date"; value: string }
  | { code: "missing-template-ingredients"; templateId: string }
  | {
      code: "invalid-ingredient-quantity";
      templateId: string;
      ingredientId: string;
      unit: string;
    }
  | { code: "inconsistent-ingredient-metadata"; ingredientId: string };

export type WeeklyMealPrepResult =
  | {
      status: "success";
      startDate: string;
      endDate: string;
      days: WeeklyMealPrepDay[];
      shoppingList: WeeklyShoppingItem[];
      batchCookingOpportunities: BatchCookingOpportunity[];
    }
  | {
      status: "invalid-input";
      errors: WeeklyMealPrepError[];
    };

const SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];
const CATEGORY_ORDER: Readonly<Record<ShoppingCategory, number>> = {
  protein: 0,
  vegetables: 1,
  fruit: 2,
  healthy_snacks: 3,
  staples: 4,
};

interface IngredientAccumulator {
  id: string;
  label: string;
  category: ShoppingCategory;
  quantity: number;
  unit: string;
  catalogueOrder: number;
  occurrenceCount: number;
  occurrenceDates: Set<string>;
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

function isoDateAt(start: Date, dayOffset: number): string {
  const date = new Date(start.getTime());
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

function chooseCandidate(
  ranked: readonly RankedMealCandidate[],
  previousTemplateId: string | undefined,
  weeklyUseCount: ReadonlyMap<string, number>,
): RankedMealCandidate | undefined {
  return (
    ranked.find(
      ({ template }) =>
        template.id !== previousTemplateId &&
        (weeklyUseCount.get(template.id) ?? 0) < 2,
    ) ??
    ranked.find(({ template }) => template.id !== previousTemplateId) ??
    ranked[0]
  );
}

function selectWeek(
  input: WeeklyMealPrepInput,
  dates: readonly string[],
): WeeklyMealPrepDay[] {
  const weeklyUseCount = new Map<string, number>();
  const previousBySlot = new Map<MealSlot, string>();
  const days: WeeklyMealPrepDay[] = [];

  for (const date of dates) {
    const officeLunchProvided = input.officeLunchByDate[date] === true;
    const dailyContext: PlannerUserContext = {
      ...input.context,
      today: date,
      lunchProvidedByOffice: officeLunchProvided,
    };
    const usedToday = new Set<string>();
    const recommendations = {} as Record<MealSlot, MealRecommendation>;

    for (const slot of SLOTS) {
      const ranked = rankMealCandidates(input.decision, dailyContext, slot, usedToday);
      const selected = chooseCandidate(
        ranked,
        previousBySlot.get(slot),
        weeklyUseCount,
      );

      if (!selected) {
        throw new Error(`No approved meal template is available for ${slot}.`);
      }

      recommendations[slot] = {
        slot: selected.slot,
        template: selected.template,
        reason: selected.reason,
      };
      usedToday.add(selected.template.id);
      weeklyUseCount.set(
        selected.template.id,
        (weeklyUseCount.get(selected.template.id) ?? 0) + 1,
      );
      previousBySlot.set(slot, selected.template.id);
    }

    days.push({
      date,
      officeLunchProvided,
      mealPlan: recommendations,
    });
  }

  return days;
}

function compareIngredients(
  a: Pick<ApprovedIngredientEntry, "category" | "catalogueOrder" | "id" | "unit">,
  b: Pick<ApprovedIngredientEntry, "category" | "catalogueOrder" | "id" | "unit">,
): number {
  return (
    CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] ||
    a.catalogueOrder - b.catalogueOrder ||
    a.id.localeCompare(b.id) ||
    a.unit.localeCompare(b.unit)
  );
}

function buildIngredientOutputs(
  days: readonly WeeklyMealPrepDay[],
  catalogue: ApprovedIngredientCatalogue,
): WeeklyMealPrepResult {
  const errors: WeeklyMealPrepError[] = [];
  const missingTemplateIds = new Set<string>();
  const invalidQuantityKeys = new Set<string>();
  const inconsistentIds = new Set<string>();
  const metadataById = new Map<
    string,
    Pick<ApprovedIngredientEntry, "label" | "category" | "catalogueOrder">
  >();
  const aggregate = new Map<string, IngredientAccumulator>();

  for (const day of days) {
    for (const slot of SLOTS) {
      const templateId = day.mealPlan[slot].template.id;
      const entries = catalogue[templateId];
      if (!entries || entries.length === 0) {
        if (!missingTemplateIds.has(templateId)) {
          missingTemplateIds.add(templateId);
          errors.push({ code: "missing-template-ingredients", templateId });
        }
        continue;
      }

      for (const entry of entries) {
        if (!Number.isFinite(entry.quantity) || entry.quantity <= 0) {
          const errorKey = `${templateId}\u0000${entry.id}\u0000${entry.unit}`;
          if (!invalidQuantityKeys.has(errorKey)) {
            invalidQuantityKeys.add(errorKey);
            errors.push({
              code: "invalid-ingredient-quantity",
              templateId,
              ingredientId: entry.id,
              unit: entry.unit,
            });
          }
          continue;
        }

        const knownMetadata = metadataById.get(entry.id);
        if (
          knownMetadata &&
          (knownMetadata.label !== entry.label ||
            knownMetadata.category !== entry.category ||
            knownMetadata.catalogueOrder !== entry.catalogueOrder)
        ) {
          if (!inconsistentIds.has(entry.id)) {
            inconsistentIds.add(entry.id);
            errors.push({
              code: "inconsistent-ingredient-metadata",
              ingredientId: entry.id,
            });
          }
          continue;
        }
        metadataById.set(entry.id, {
          label: entry.label,
          category: entry.category,
          catalogueOrder: entry.catalogueOrder,
        });

        const aggregateKey = `${entry.id}\u0000${entry.unit}`;
        const current = aggregate.get(aggregateKey);
        if (current) {
          current.quantity += entry.quantity;
          current.occurrenceCount += 1;
          current.occurrenceDates.add(day.date);
        } else {
          aggregate.set(aggregateKey, {
            ...entry,
            occurrenceCount: 1,
            occurrenceDates: new Set([day.date]),
          });
        }
      }
    }
  }

  if (errors.length > 0) {
    return { status: "invalid-input", errors };
  }

  const accumulators = [...aggregate.values()].sort(compareIngredients);
  const shoppingList: WeeklyShoppingItem[] = accumulators.map((entry) => ({
    id: entry.id,
    label: entry.label,
    category: entry.category,
    quantity: entry.quantity,
    unit: entry.unit,
    catalogueOrder: entry.catalogueOrder,
    occurrenceCount: entry.occurrenceCount,
    occurrenceDates: [...entry.occurrenceDates],
  }));
  const batchCookingOpportunities: BatchCookingOpportunity[] = accumulators
    .filter(
      (entry): entry is IngredientAccumulator & { category: "protein" | "staples" } =>
        (entry.category === "protein" || entry.category === "staples") &&
        entry.occurrenceCount >= 2,
    )
    .map((entry) => ({
      ingredientId: entry.id,
      label: entry.label,
      category: entry.category,
      quantity: entry.quantity,
      unit: entry.unit,
      catalogueOrder: entry.catalogueOrder,
      occurrenceCount: entry.occurrenceCount,
      occurrenceDates: [...entry.occurrenceDates],
    }));

  return {
    status: "success",
    startDate: days[0].date,
    endDate: days[days.length - 1].date,
    days: [...days],
    shoppingList,
    batchCookingOpportunities,
  };
}

export function generateWeeklyMealPrep(
  input: WeeklyMealPrepInput,
): WeeklyMealPrepResult {
  const start = parseIsoDate(input.context.today);
  if (!start) {
    return {
      status: "invalid-input",
      errors: [{ code: "invalid-start-date", value: input.context.today }],
    };
  }

  const dates = Array.from({ length: 7 }, (_, index) => isoDateAt(start, index));
  const days = selectWeek(input, dates);
  return buildIngredientOutputs(days, input.ingredientCatalogue);
}
