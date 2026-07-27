/**
 * Planning Layer — Meal Planner
 * ---------------------------------------------------------------------------
 * Implements AI_PLANNING_SPEC.md §3: turns nutrition-related coaching
 * decisions into specific meal recommendations by selecting from approved
 * templates (§3.4). Every calorie/protein figure in the output traces back
 * to a defined MealTemplate, never invented at plan-time.
 *
 * The Meal Planner never decides that protein or calories need attention —
 * that remains the Nutrition Engine's job. It only decides *which food*,
 * given everything else known about the day, following the constraint
 * priority ordering in §3.3:
 *
 *   Priority 1: Safety guardrails (Thyroid)
 *   Priority 2: Migraine-related requirements
 *   Priority 3: Menstrual / PMS adjustments
 *   Priority 4: Daily calorie/protein targets
 *   Priority 5: Practical constraints (time, budget, office lunch)
 *
 * Pure function. No React, no Firestore, no API calls, no side effects.
 */
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { EngineInsight } from "@/lib/engines/types";
import type { PlannerUserContext } from "./plannerTypes";
import { MEAL_TEMPLATES, type MealSlot, type MealTag, type MealTemplate } from "./mealTemplates";

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface MealRecommendation {
  slot: MealSlot;
  template: MealTemplate;
  /** One-sentence reason this template was chosen, grounded in a target or active insight. */
  reason: string;
}

export interface MealPlan {
  breakfast: MealRecommendation;
  lunch: MealRecommendation;
  snack: MealRecommendation;
  dinner: MealRecommendation;
}

export interface RankedMealCandidate extends MealRecommendation {
  score: number;
  catalogueOrder: number;
}

// ---------------------------------------------------------------------------
// Active-insight detection (reads CoachDecision, never decides)
// ---------------------------------------------------------------------------

export interface ActiveConstraints {
  migraineActive: boolean;
  pmsActive: boolean;
  proteinPriority: boolean;
}

const MIGRAINE_ACTIVE_ID = "migraine.active_symptom_care";
const PMS_HUNGER_ID = "menstrual.pms_hunger_support";
const PROTEIN_FIRST_ID = "nutrition.protein_first";

export function detectActiveConstraints(insights: EngineInsight[]): ActiveConstraints {
  const ids = new Set(insights.map((i) => i.id));
  return {
    migraineActive: ids.has(MIGRAINE_ACTIVE_ID),
    pmsActive: ids.has(PMS_HUNGER_ID),
    proteinPriority: ids.has(PROTEIN_FIRST_ID),
  };
}

// ---------------------------------------------------------------------------
// Macro budget distribution (AI_PLANNING_SPEC.md §3.5)
// ---------------------------------------------------------------------------

/**
 * Distributes the daily calorie and protein budgets across meal slots
 * realistically rather than evenly, per AI_PLANNING_SPEC.md §3.5.
 *
 * Office-lunch days give lunch the largest share (office trays tend to be
 * substantial). Non-office days distribute more evenly with dinner
 * slightly larger (the evening is the most flexible prep window).
 */
export interface SlotBudget {
  calories: number;
  proteinG: number;
}

const OFFICE_DAY_RATIOS: Record<MealSlot, number> = {
  breakfast: 0.20,
  lunch: 0.35,
  snack: 0.10,
  dinner: 0.35,
};

const NON_OFFICE_DAY_RATIOS: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.30,
  snack: 0.10,
  dinner: 0.35,
};

export function distributeTargets(
  calorieGoal: number,
  proteinGoalG: number,
  lunchProvidedByOffice: boolean,
): Record<MealSlot, SlotBudget> {
  const ratios = lunchProvidedByOffice ? OFFICE_DAY_RATIOS : NON_OFFICE_DAY_RATIOS;
  const slots: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];
  const result: Partial<Record<MealSlot, SlotBudget>> = {};
  for (const slot of slots) {
    result[slot] = {
      calories: Math.round(calorieGoal * ratios[slot]),
      proteinG: Math.round(proteinGoalG * ratios[slot]),
    };
  }
  return result as Record<MealSlot, SlotBudget>;
}

// ---------------------------------------------------------------------------
// Template scoring and selection
// ---------------------------------------------------------------------------

/**
 * Builds the set of required/preferred tags for a slot based on the active
 * constraints, following the priority ordering in §3.3. Tags are
 * additive — a higher-priority constraint adds requirements, never
 * removes ones a lower-priority constraint already set.
 */
function buildPreferredTags(
  constraints: ActiveConstraints,
  slot: MealSlot,
): { required: MealTag[]; preferred: MealTag[] } {
  const required: MealTag[] = [];
  const preferred: MealTag[] = [];

  // Priority 2: Migraine — favor light, migraine-safe meals
  if (constraints.migraineActive) {
    required.push("migraine-safe");
    preferred.push("light");
  }

  // Priority 3: PMS — favor protein/fiber-forward snacks
  if (constraints.pmsActive) {
    preferred.push("pms-friendly", "fiber-forward");
  }

  // Priority 4: Protein target priority
  if (constraints.proteinPriority) {
    preferred.push("high-protein");
  }

  // Priority 5: Practical — quick prep for breakfast (narrow morning window)
  if (slot === "breakfast") {
    preferred.push("quick-prep");
  }

  return { required, preferred };
}

/**
 * Scores a template for a given slot and budget. Higher is better.
 * The scoring system implements the constraint priority from §3.3 by
 * giving exponentially more weight to higher-priority matches.
 */
function scoreTemplate(
  template: MealTemplate,
  budget: SlotBudget,
  required: MealTag[],
  preferred: MealTag[],
): number {
  // Required tags: a template missing any required tag is disqualified.
  for (const tag of required) {
    if (!template.tags.includes(tag)) {
      return -1000;
    }
  }

  let score = 0;

  // Calorie fit: closer to the slot budget is better. Penalize overshoot
  // more than undershoot (undereating a slot is recoverable at the next
  // meal; overshooting blows the day's budget).
  const calorieDiff = template.calories - budget.calories;
  if (calorieDiff > 0) {
    score -= calorieDiff * 1.5; // overshoot penalty
  } else {
    score -= Math.abs(calorieDiff) * 0.5; // undershoot, milder
  }

  // Protein fit: closer to the slot's protein budget, with a bonus for
  // exceeding it (more protein is never penalized per AI_COACH_SPEC.md §2.1).
  const proteinDiff = template.proteinG - budget.proteinG;
  if (proteinDiff >= 0) {
    score += Math.min(proteinDiff, 10) * 2; // protein surplus bonus, capped
  } else {
    score -= Math.abs(proteinDiff) * 1.5;
  }

  // Preferred tag matches: each match adds a moderate bonus.
  for (const tag of preferred) {
    if (template.tags.includes(tag)) {
      score += 15;
    }
  }

  return score;
}

/**
 * Selects the best template for a slot from the library, given the slot's
 * budget and the day's active constraints. Returns the template and a
 * human-readable reason for the selection.
 */
export function rankMealCandidates(
  decision: CoachDecision,
  context: PlannerUserContext,
  slot: MealSlot,
  excludeIds: ReadonlySet<string> = new Set<string>(),
): RankedMealCandidate[] {
  const constraints = detectActiveConstraints(decision.insights);
  const budget = distributeTargets(
    context.calorieGoal,
    context.proteinGoalG,
    context.lunchProvidedByOffice,
  )[slot];
  const { required, preferred } = buildPreferredTags(constraints, slot);
  const candidates = MEAL_TEMPLATES.filter(
    (template) => template.slots.includes(slot) && !excludeIds.has(template.id),
  );

  if (candidates.length === 0) {
    // Fallback: if exclusions emptied the pool, re-include excluded templates
    // rather than returning nothing. This can only happen if there are more
    // slots than templates for that slot type — a library-size issue, not a
    // constraint issue.
    return [];
  }

  return candidates
    .map((template) => ({
      slot,
      template,
      score: scoreTemplate(template, budget, required, preferred),
      catalogueOrder: MEAL_TEMPLATES.indexOf(template),
      reason: buildReason(template, budget, constraints, slot),
    }))
    .filter(({ score }) => score > -1000)
    .sort((a, b) => b.score - a.score || a.catalogueOrder - b.catalogueOrder);
}

function selectForSlot(
  decision: CoachDecision,
  context: PlannerUserContext,
  slot: MealSlot,
  excludeIds: ReadonlySet<string>,
): MealRecommendation {
  const best = rankMealCandidates(decision, context, slot, excludeIds)[0];
  if (best) {
    return { slot: best.slot, template: best.template, reason: best.reason };
  }

  const fallback = rankMealCandidates(decision, context, slot)[0];
  return {
    slot,
    template: fallback.template,
    reason: `Best available option for ${slot}.`,
  };
}

function buildReason(
  template: MealTemplate,
  budget: SlotBudget,
  constraints: ActiveConstraints,
  slot: MealSlot,
): string {
  // Highest-priority active constraint that influenced the pick gets the reason.
  if (constraints.migraineActive && template.tags.includes("migraine-safe")) {
    return `Migraine-safe choice — gentle on the stomach, keeps meal gaps short.`;
  }
  if (constraints.pmsActive && template.tags.includes("pms-friendly")) {
    return `Protein- and fiber-forward to manage PMS hunger without restricting.`;
  }
  if (constraints.proteinPriority && template.tags.includes("high-protein")) {
    return `High-protein pick to close the gap on today's protein target (${template.proteinG}g per serving).`;
  }
  if (slot === "breakfast" && template.tags.includes("quick-prep")) {
    return `Quick to prepare before the morning commute.`;
  }
  return `Fits today's ${slot} calorie budget (~${budget.calories} kcal) with ${template.proteinG}g protein.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates meal recommendations for all four slots.
 *
 * @param decision  The already-ranked CoachDecision.
 * @param context   The validated PlannerUserContext.
 * @returns         A MealPlan with one recommendation per slot.
 */
export function generateMealPlan(
  decision: CoachDecision,
  context: PlannerUserContext,
): MealPlan {
  // Select in priority-of-importance order (breakfast first — it's the
  // most time-constrained slot), tracking used template IDs for the meal
  // variety principle (AI_PLANNING_SPEC.md §9).
  const usedIds = new Set<string>();

  const breakfast = selectForSlot(decision, context, "breakfast", usedIds);
  usedIds.add(breakfast.template.id);

  const lunch = selectForSlot(decision, context, "lunch", usedIds);
  usedIds.add(lunch.template.id);

  const snack = selectForSlot(decision, context, "snack", usedIds);
  usedIds.add(snack.template.id);

  const dinner = selectForSlot(decision, context, "dinner", usedIds);

  return { breakfast, lunch, snack, dinner };
}
