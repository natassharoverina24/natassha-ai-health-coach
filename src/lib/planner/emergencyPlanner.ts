import type { CoachDecision } from "@/lib/engines/decisionEngine";
import {
  generateMealPlan,
  rankMealCandidates,
  type MealRecommendation,
} from "./mealPlanner";
import type { MealSlot } from "./mealTemplates";
import type { PlannerUserContext } from "./plannerTypes";

export type EmergencyDisruption =
  | { type: "missed-breakfast"; occurredAt: string }
  | { type: "late-dinner"; expectedDinnerAt: string }
  | { type: "overtime"; expectedEndAt: string }
  | { type: "restaurant"; mealSlot: "lunch" | "dinner" }
  | { type: "mall-trip"; mealSlot: "lunch" | "dinner" }
  | { type: "travel"; affectedSlots: MealSlot[] }
  | { type: "birthday"; mealSlot: "lunch" | "dinner" }
  | { type: "wedding"; mealSlot: "lunch" | "dinner" };

export interface TemplateEmergencyAction {
  kind: "approved-template";
  slot: MealSlot;
  recommendation: MealRecommendation;
  purpose: "retain-meal" | "substantive-meal" | "quick-prep-fallback";
}

export interface MealShapeEmergencyAction {
  kind: "meal-shape";
  slot: "lunch" | "dinner";
  components: readonly ["protein", "staple-or-carbohydrate", "vegetables"];
  reason: string;
}

export type EmergencyMealAction =
  | TemplateEmergencyAction
  | MealShapeEmergencyAction;

export type EmergencyPlanError =
  | {
      code: "invalid-clock";
      field: "occurredAt" | "expectedDinnerAt" | "expectedEndAt";
    }
  | { code: "empty-affected-slots"; field: "affectedSlots" };

export type EmergencyNotApplicableReason =
  | "no-eligible-quick-prep-template"
  | "unsupported-slot-combination"
  | "unsupported-disruption";

export type EmergencyPlanResult =
  | {
      status: "success";
      disruptionType: EmergencyDisruption["type"];
      actions: EmergencyMealAction[];
    }
  | {
      status: "not-applicable";
      reason: EmergencyNotApplicableReason;
    }
  | {
      status: "invalid-input";
      errors: EmergencyPlanError[];
    };

const SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];
const EXTERNAL_EVENT_TYPES = new Set<EmergencyDisruption["type"]>([
  "restaurant",
  "mall-trip",
  "birthday",
  "wedding",
]);

function isClock(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function retainedAction(
  recommendation: MealRecommendation,
  purpose: TemplateEmergencyAction["purpose"] = "retain-meal",
): TemplateEmergencyAction {
  return {
    kind: "approved-template",
    slot: recommendation.slot,
    recommendation,
    purpose,
  };
}

function quickPrepAction(
  decision: CoachDecision,
  context: PlannerUserContext,
  slot: MealSlot,
  excludedIds: ReadonlySet<string>,
): TemplateEmergencyAction | null {
  const candidate = rankMealCandidates(decision, context, slot, excludedIds)
    .find(({ template }) => template.tags.includes("quick-prep"));
  if (!candidate) {
    return null;
  }
  return retainedAction(
    {
      slot,
      template: candidate.template,
      reason: candidate.reason,
    },
    "quick-prep-fallback",
  );
}

function externalMealShape(
  type: "restaurant" | "mall-trip" | "birthday" | "wedding",
  slot: "lunch" | "dinner",
): MealShapeEmergencyAction {
  return {
    kind: "meal-shape",
    slot,
    components: ["protein", "staple-or-carbohydrate", "vegetables"],
    reason:
      type === "birthday" || type === "wedding"
        ? `Keep normal eating around the ${type} and use the approved meal shape for ${slot} without compensating.`
        : `Keep ${slot} and use the approved meal shape without estimating external nutrition.`,
  };
}

function externalEventPlan(
  decision: CoachDecision,
  context: PlannerUserContext,
  disruption: Extract<
    EmergencyDisruption,
    { type: "restaurant" | "mall-trip" | "birthday" | "wedding" }
  >,
): EmergencyPlanResult {
  if (disruption.mealSlot !== "lunch" && disruption.mealSlot !== "dinner") {
    return { status: "not-applicable", reason: "unsupported-slot-combination" };
  }

  const plan = generateMealPlan(decision, context);
  const actions: EmergencyMealAction[] = SLOTS.map((slot) =>
    slot === disruption.mealSlot
      ? externalMealShape(disruption.type, disruption.mealSlot)
      : retainedAction(plan[slot]),
  );
  return { status: "success", disruptionType: disruption.type, actions };
}

function travelPlan(
  decision: CoachDecision,
  context: PlannerUserContext,
  affectedSlots: MealSlot[],
): EmergencyPlanResult {
  if (affectedSlots.length === 0) {
    return {
      status: "invalid-input",
      errors: [{ code: "empty-affected-slots", field: "affectedSlots" }],
    };
  }

  const deduplicated = affectedSlots.filter(
    (slot, index) => affectedSlots.indexOf(slot) === index,
  );
  if (deduplicated.some((slot) => !SLOTS.includes(slot))) {
    return { status: "not-applicable", reason: "unsupported-slot-combination" };
  }

  const plan = generateMealPlan(decision, context);
  const affected = new Set(deduplicated);
  const usedIds = new Set(
    SLOTS
      .filter((slot) => !affected.has(slot))
      .map((slot) => plan[slot].template.id),
  );
  const replacements = new Map<MealSlot, TemplateEmergencyAction>();

  for (const slot of deduplicated) {
    const action = quickPrepAction(decision, context, slot, usedIds);
    if (!action) {
      return {
        status: "not-applicable",
        reason: "no-eligible-quick-prep-template",
      };
    }
    replacements.set(slot, action);
    usedIds.add(action.recommendation.template.id);
  }

  return {
    status: "success",
    disruptionType: "travel",
    actions: SLOTS.map(
      (slot) => replacements.get(slot) ?? retainedAction(plan[slot]),
    ),
  };
}

export function generateEmergencyPlan(
  decision: CoachDecision,
  context: PlannerUserContext,
  disruption: EmergencyDisruption,
): EmergencyPlanResult {
  if (disruption.type === "missed-breakfast") {
    if (!isClock(disruption.occurredAt)) {
      return {
        status: "invalid-input",
        errors: [{ code: "invalid-clock", field: "occurredAt" }],
      };
    }
    const plan = generateMealPlan(decision, context);
    return {
      status: "success",
      disruptionType: disruption.type,
      actions: [
        retainedAction(plan.lunch, "substantive-meal"),
        retainedAction(plan.snack, "substantive-meal"),
        retainedAction(plan.dinner),
      ],
    };
  }

  if (disruption.type === "late-dinner") {
    if (!isClock(disruption.expectedDinnerAt)) {
      return {
        status: "invalid-input",
        errors: [{ code: "invalid-clock", field: "expectedDinnerAt" }],
      };
    }
    const plan = generateMealPlan(decision, context);
    return {
      status: "success",
      disruptionType: disruption.type,
      actions: [
        retainedAction(plan.snack, "substantive-meal"),
        retainedAction(plan.dinner),
      ],
    };
  }

  if (disruption.type === "overtime") {
    if (!isClock(disruption.expectedEndAt)) {
      return {
        status: "invalid-input",
        errors: [{ code: "invalid-clock", field: "expectedEndAt" }],
      };
    }
    const plan = generateMealPlan(decision, context);
    const usedIds = new Set([
      plan.breakfast.template.id,
      plan.lunch.template.id,
    ]);
    const snack = quickPrepAction(decision, context, "snack", usedIds);
    if (!snack) {
      return {
        status: "not-applicable",
        reason: "no-eligible-quick-prep-template",
      };
    }
    usedIds.add(snack.recommendation.template.id);
    const dinner = quickPrepAction(decision, context, "dinner", usedIds);
    if (!dinner) {
      return {
        status: "not-applicable",
        reason: "no-eligible-quick-prep-template",
      };
    }
    return {
      status: "success",
      disruptionType: disruption.type,
      actions: [snack, dinner],
    };
  }

  if (disruption.type === "travel") {
    return travelPlan(decision, context, disruption.affectedSlots);
  }

  if (EXTERNAL_EVENT_TYPES.has(disruption.type)) {
    return externalEventPlan(
      decision,
      context,
      disruption as Extract<
        EmergencyDisruption,
        { type: "restaurant" | "mall-trip" | "birthday" | "wedding" }
      >,
    );
  }

  return { status: "not-applicable", reason: "unsupported-disruption" };
}
