/**
 * Planning Layer — Office Lunch Optimizer
 * ---------------------------------------------------------------------------
 * Implements AI_PLANNING_SPEC.md §4. This pure function operationalizes
 * retained CoachDecision insights against the predefined office-lunch
 * catalogue. It does not create coaching decisions or nutrition facts.
 */
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import { OFFICE_LUNCH_ITEMS } from "@/lib/utils/nutritionEstimates";
import type { MealMacro } from "@/types/firestore";
import { detectActiveConstraints } from "./mealPlanner";
import type { PlannerUserContext } from "./plannerTypes";

export type OfficeLunchAction = "Eat" | "Reduce" | "Skip" | "Add";

export interface RemainingNutritionBudget {
  /** Remaining day-level calories before office lunch. */
  calories: number;
  /** Remaining day-level protein target before office lunch. */
  proteinG: number;
}

export interface OfficeLunchMenuSelection {
  /**
   * Catalogue keys that are actually available on today's office tray.
   * Omit the selection to preserve the original all-catalogue contract.
   */
  itemKeys: readonly string[];
}

export interface OfficeLunchRecommendation {
  itemKey: string;
  label: string;
  serving: string;
  macros: MealMacro;
  action: OfficeLunchAction;
  /** One sentence grounded in the immutable budget or a retained insight. */
  reason: string;
}

export interface ApplicableOfficeLunchPlan {
  applicable: true;
  recommendations: OfficeLunchRecommendation[];
}

export interface NotApplicableOfficeLunchPlan {
  applicable: false;
  reason: string;
}

export type OfficeLunchPlan = ApplicableOfficeLunchPlan | NotApplicableOfficeLunchPlan;

const ADD_PROTEIN_CATALOGUE_ORDER = ["chicken", "fish", "egg", "tempe", "tofu"] as const;
const SUBSTANTIVE_LUNCH_KEYS = new Set(["rice", ...ADD_PROTEIN_CATALOGUE_ORDER]);

function assertBudget(budget: RemainingNutritionBudget): void {
  if (
    !Number.isFinite(budget.calories) ||
    budget.calories < 0 ||
    !Number.isFinite(budget.proteinG) ||
    budget.proteinG < 0
  ) {
    throw new RangeError("Remaining calorie and protein budgets must be finite, non-negative values.");
  }
}

function baseRecommendation(
  item: (typeof OFFICE_LUNCH_ITEMS)[number],
  budget: RemainingNutritionBudget,
): OfficeLunchRecommendation {
  const macros = { ...item.macros };

  if (item.macros.calories > budget.calories) {
    return {
      itemKey: item.key,
      label: item.label,
      serving: item.serving,
      macros,
      action: "Reduce",
      reason: `Reduce the predefined serving because its ${item.macros.calories} kcal exceeds the remaining daily budget of ${budget.calories} kcal; calorie overshoot is handled by portion reduction.`,
    };
  }

  return {
    itemKey: item.key,
    label: item.label,
    serving: item.serving,
    macros,
    action: "Eat",
    reason: `Eat the predefined serving because its ${item.macros.calories} kcal fits within the remaining daily budget of ${budget.calories} kcal.`,
  };
}

function applyAddProtein(
  recommendations: OfficeLunchRecommendation[],
  pmsActive: boolean,
  proteinPriority: boolean,
  budget: RemainingNutritionBudget,
): void {
  if (!pmsActive && !proteinPriority) return;

  const selectedKey = ADD_PROTEIN_CATALOGUE_ORDER.find((key) =>
    recommendations.some((recommendation) => recommendation.itemKey === key),
  );
  if (!selectedKey) return;

  const selected = recommendations.find((recommendation) => recommendation.itemKey === selectedKey);
  if (!selected) return;

  selected.action = "Add";
  selected.reason = pmsActive
    ? `Add the predefined ${selected.label} serving because the retained PMS insight calls for one protein-forward addition.`
    : `Add the predefined ${selected.label} serving because the retained protein-first insight prioritizes closing the remaining ${budget.proteinG} g protein target.`;
}

function preserveSubstantiveMigraineLunch(
  recommendations: OfficeLunchRecommendation[],
  migraineActive: boolean,
  budget: RemainingNutritionBudget,
): void {
  if (!migraineActive) return;

  const hasSubstantiveLunch = recommendations.some(
    (recommendation) =>
      SUBSTANTIVE_LUNCH_KEYS.has(recommendation.itemKey) &&
      (recommendation.action === "Eat" || recommendation.action === "Reduce"),
  );
  if (hasSubstantiveLunch) return;

  const fallback = recommendations.find((recommendation) => recommendation.itemKey === "rice");
  if (!fallback) return;

  fallback.action = fallback.macros.calories > budget.calories ? "Reduce" : "Eat";
  fallback.reason =
    fallback.action === "Reduce"
      ? `Reduce the predefined Rice serving because the retained migraine insight requires a substantive lunch while its calories exceed the remaining daily budget.`
      : `Eat the predefined Rice serving because the retained migraine insight requires a substantive lunch and it fits the remaining daily calorie budget.`;
}

/**
 * Returns deterministic guidance for every office-lunch catalogue item.
 *
 * Every item is first evaluated independently against the same immutable
 * day-level budget. Retained PMS/protein-first insights may then designate
 * exactly one catalogue serving as Add, and retained migraine care enforces
 * the approved substantive-lunch invariant.
 */
export function generateOfficeLunchPlan(
  decision: CoachDecision,
  context: PlannerUserContext,
  remainingBudget: RemainingNutritionBudget,
  menuSelection?: OfficeLunchMenuSelection,
): OfficeLunchPlan {
  if (!context.lunchProvidedByOffice) {
    return {
      applicable: false,
      reason: "Office Lunch Optimizer is not applicable because lunch is not office-provided.",
    };
  }

  assertBudget(remainingBudget);

  const constraints = detectActiveConstraints(decision.insights);
  const selectedKeys = menuSelection ? new Set(menuSelection.itemKeys) : null;
  const recommendations = OFFICE_LUNCH_ITEMS.filter(
    (item) => selectedKeys === null || selectedKeys.has(item.key),
  ).map((item) => baseRecommendation(item, remainingBudget));

  // Thyroid is intentionally not used to prefer, avoid, Add, Reduce, or Skip
  // any food. Its retained deficit guardrail must not deepen restriction.
  applyAddProtein(
    recommendations,
    constraints.pmsActive,
    constraints.proteinPriority,
    remainingBudget,
  );
  preserveSubstantiveMigraineLunch(recommendations, constraints.migraineActive, remainingBudget);

  return { applicable: true, recommendations };
}
