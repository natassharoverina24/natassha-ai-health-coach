import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { EngineInsight } from "@/lib/engines/types";
import {
  generateOfficeLunchPlan,
  type ApplicableOfficeLunchPlan,
  type RemainingNutritionBudget,
} from "@/lib/planner/officeLunchOptimizer";
import type { PlannerUserContext } from "@/lib/planner/plannerTypes";
import { DEFAULT_GOALS } from "@/lib/utils/constants";
import { OFFICE_LUNCH_ITEMS } from "@/lib/utils/nutritionEstimates";

function insight(overrides: Partial<EngineInsight>): EngineInsight {
  return {
    id: "test.insight",
    engine: "behavior",
    priority: "medium",
    urgency: "soon",
    tone: "neutral",
    summary: "A retained fact.",
    reason: "A retained reason.",
    recommendedAction: "A retained action.",
    ...overrides,
  };
}

function makeDecision(insights: EngineInsight[] = []): CoachDecision {
  return { insights, suppressedEngineNames: [], generatedAt: "2026-07-25T06:00:00.000Z" };
}

function makeContext(overrides: Partial<PlannerUserContext> = {}): PlannerUserContext {
  return {
    today: "2026-07-25",
    currentHour: 11,
    currentMinute: 30,
    leaveHomeTime: "06:30",
    arriveHomeTime: "19:00",
    lunchProvidedByOffice: true,
    calorieGoal: DEFAULT_GOALS.calorieGoal,
    proteinGoalG: DEFAULT_GOALS.proteinGoalG,
    waterGoalMl: DEFAULT_GOALS.waterGoalMl,
    workoutGoalMinPerDay: DEFAULT_GOALS.workoutGoalMinPerDay,
    stepsGoal: DEFAULT_GOALS.stepsGoal,
    sleepGoalHours: DEFAULT_GOALS.sleepGoalHours,
    ...overrides,
  };
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function applicablePlan(
  insights: EngineInsight[] = [],
  budget: RemainingNutritionBudget = { calories: 500, proteinG: 50 },
): ApplicableOfficeLunchPlan {
  const plan = generateOfficeLunchPlan(makeDecision(insights), makeContext(), budget);
  if (!plan.applicable) throw new Error("Expected an applicable office lunch plan.");
  return plan;
}

describe("generateOfficeLunchPlan — applicability and catalogue contract", () => {
  it("returns a typed not-applicable result when lunch is not office-provided", () => {
    const plan = generateOfficeLunchPlan(
      makeDecision(),
      makeContext({ lunchProvidedByOffice: false }),
      { calories: 500, proteinG: 50 },
    );

    expect(plan).toEqual({
      applicable: false,
      reason: "Office Lunch Optimizer is not applicable because lunch is not office-provided.",
    });
  });

  it("returns exactly one recommendation for all 11 catalogue items in catalogue order", () => {
    const plan = applicablePlan();

    expect(plan.recommendations).toHaveLength(11);
    expect(plan.recommendations.map((recommendation) => recommendation.itemKey)).toEqual(
      OFFICE_LUNCH_ITEMS.map((item) => item.key),
    );
    expect(new Set(plan.recommendations.map((recommendation) => recommendation.itemKey)).size).toBe(11);
  });

  it("copies only predefined servings and macros", () => {
    const plan = applicablePlan();

    for (const recommendation of plan.recommendations) {
      const catalogueItem = OFFICE_LUNCH_ITEMS.find((item) => item.key === recommendation.itemKey);
      expect(catalogueItem).toBeDefined();
      expect(recommendation.label).toBe(catalogueItem?.label);
      expect(recommendation.serving).toBe(catalogueItem?.serving);
      expect(recommendation.macros).toEqual(catalogueItem?.macros);
      expect(recommendation.macros).not.toBe(catalogueItem?.macros);
    }
  });

  it("does not mutate its inputs or catalogue data", () => {
    const decision = makeDecision();
    const context = makeContext();
    const budget = { calories: 500, proteinG: 50 };
    const decisionBefore = cloneData(decision);
    const contextBefore = cloneData(context);
    const budgetBefore = cloneData(budget);
    const catalogueBefore = cloneData(OFFICE_LUNCH_ITEMS);

    generateOfficeLunchPlan(decision, context, budget);

    expect(decision).toEqual(decisionBefore);
    expect(context).toEqual(contextBefore);
    expect(budget).toEqual(budgetBefore);
    expect(OFFICE_LUNCH_ITEMS).toEqual(catalogueBefore);
  });

  it("rejects invalid remaining budgets", () => {
    expect(() => applicablePlan([], { calories: -1, proteinG: 50 })).toThrow(RangeError);
    expect(() => applicablePlan([], { calories: 500, proteinG: Number.NaN })).toThrow(RangeError);
  });

  it("returns only today's selected catalogue items in catalogue order", () => {
    const plan = generateOfficeLunchPlan(
      makeDecision(),
      makeContext(),
      { calories: 500, proteinG: 50 },
      { itemKeys: ["vegetables", "fish", "vegetables", "unknown"] },
    );

    expect(plan.applicable).toBe(true);
    if (!plan.applicable) return;
    expect(plan.recommendations.map((recommendation) => recommendation.itemKey)).toEqual([
      "fish",
      "vegetables",
    ]);
  });

  it("does not mutate the selected-menu input", () => {
    const selection = { itemKeys: ["rice", "egg"] };
    const before = cloneData(selection);

    generateOfficeLunchPlan(
      makeDecision(),
      makeContext(),
      { calories: 500, proteinG: 50 },
      selection,
    );

    expect(selection).toEqual(before);
  });
});

describe("generateOfficeLunchPlan — ordinary target handling", () => {
  it("returns all Eat when every predefined serving fits the same immutable budget", () => {
    const plan = applicablePlan([], { calories: 500, proteinG: 0 });

    expect(plan.recommendations.every((recommendation) => recommendation.action === "Eat")).toBe(true);
  });

  it("uses Reduce for calorie overshoot and never automatically uses Skip", () => {
    const plan = applicablePlan([], { calories: 100, proteinG: 50 });
    const byKey = Object.fromEntries(
      plan.recommendations.map((recommendation) => [recommendation.itemKey, recommendation]),
    );

    expect(byKey.rice.action).toBe("Reduce");
    expect(byKey.chicken.action).toBe("Reduce");
    expect(byKey.tofu.action).toBe("Eat");
    expect(plan.recommendations.every((recommendation) => recommendation.action !== "Skip")).toBe(true);
  });

  it("never treats protein as a maximum", () => {
    const plan = applicablePlan([], { calories: 500, proteinG: 0 });

    for (const key of ["chicken", "fish", "egg", "tempe", "tofu"]) {
      expect(plan.recommendations.find((recommendation) => recommendation.itemKey === key)?.action).toBe(
        "Eat",
      );
    }
  });

  it("evaluates every item's calorie fit against the same budget", () => {
    const plan = applicablePlan([], { calories: 150, proteinG: 50 });

    for (const recommendation of plan.recommendations) {
      expect(recommendation.action).toBe(recommendation.macros.calories > 150 ? "Reduce" : "Eat");
      expect(recommendation.reason).toContain("150 kcal");
    }
  });
});

describe("generateOfficeLunchPlan — retained PMS and protein-first insights", () => {
  it("uses the catalogue-order tie-breaker for exactly one PMS Add-protein action", () => {
    const plan = applicablePlan([
      insight({ id: "menstrual.pms_hunger_support", engine: "menstrual" }),
    ]);
    const additions = plan.recommendations.filter((recommendation) => recommendation.action === "Add");

    expect(additions).toHaveLength(1);
    expect(additions[0].itemKey).toBe("chicken");
    expect(additions[0].macros).toEqual(
      OFFICE_LUNCH_ITEMS.find((item) => item.key === "chicken")?.macros,
    );
    expect(additions[0].reason).toContain("retained PMS insight");
  });

  it("uses the catalogue-order tie-breaker for exactly one protein-first Add action", () => {
    const plan = applicablePlan(
      [insight({ id: "nutrition.protein_first", engine: "nutrition" })],
      { calories: 500, proteinG: 42 },
    );
    const additions = plan.recommendations.filter((recommendation) => recommendation.action === "Add");

    expect(additions).toHaveLength(1);
    expect(additions[0].itemKey).toBe("chicken");
    expect(additions[0].reason).toContain("remaining 42 g protein target");
  });

  it("produces only one Add when PMS and protein-first are both retained", () => {
    const plan = applicablePlan([
      insight({ id: "menstrual.pms_hunger_support", engine: "menstrual" }),
      insight({ id: "nutrition.protein_first", engine: "nutrition" }),
    ]);

    expect(plan.recommendations.filter((recommendation) => recommendation.action === "Add")).toHaveLength(
      1,
    );
    expect(plan.recommendations.find((recommendation) => recommendation.action === "Add")?.itemKey).toBe(
      "chicken",
    );
  });

  it("uses the first available selected protein instead of an unavailable catalogue item", () => {
    const plan = generateOfficeLunchPlan(
      makeDecision([insight({ id: "nutrition.protein_first", engine: "nutrition" })]),
      makeContext(),
      { calories: 500, proteinG: 42 },
      { itemKeys: ["vegetables", "fish", "tofu"] },
    );

    expect(plan.applicable).toBe(true);
    if (!plan.applicable) return;
    expect(plan.recommendations.map((recommendation) => recommendation.itemKey)).toEqual([
      "fish",
      "tofu",
      "vegetables",
    ]);
    expect(plan.recommendations.filter((recommendation) => recommendation.action === "Add")).toEqual([
      expect.objectContaining({ itemKey: "fish" }),
    ]);
  });
});

describe("generateOfficeLunchPlan — Thyroid containment", () => {
  const thyroidInsight = insight({
    id: "thyroid.deficit_too_aggressive",
    engine: "thyroid",
    priority: "critical",
  });

  it("does not introduce food-specific restrictions", () => {
    const baseline = applicablePlan();
    const thyroid = applicablePlan([thyroidInsight]);

    expect(thyroid).toEqual(baseline);
    expect(thyroid.recommendations.every((recommendation) => recommendation.action !== "Skip")).toBe(true);
  });

  it("does not deepen calorie restriction when the budget is low", () => {
    const plan = applicablePlan([thyroidInsight], { calories: 50, proteinG: 50 });

    expect(plan.recommendations.every((recommendation) => recommendation.action === "Reduce")).toBe(true);
    expect(plan.recommendations.every((recommendation) => recommendation.action !== "Skip")).toBe(true);
  });

  it("does not fabricate thyroid, diet, supplement, medication, or medical rationale", () => {
    const plan = applicablePlan([thyroidInsight]);
    const reasons = plan.recommendations.map((recommendation) => recommendation.reason).join(" ");

    expect(reasons).not.toMatch(
      /thyroid|diet|supplement|medication|iodine|selenium|iron|calcium|gluten|soy|cruciferous|treat|cure/i,
    );
  });
});

describe("generateOfficeLunchPlan — migraine substantive-lunch protection", () => {
  const migraineInsight = insight({
    id: "migraine.active_symptom_care",
    engine: "migraine",
    priority: "high",
    urgency: "now",
  });

  it("keeps at least one substantive item as Eat or Reduce", () => {
    const plan = applicablePlan([migraineInsight], { calories: 0, proteinG: 50 });
    const substantiveKeys = new Set(["rice", "chicken", "fish", "egg", "tempe", "tofu"]);

    expect(
      plan.recommendations.some(
        (recommendation) =>
          substantiveKeys.has(recommendation.itemKey) &&
          (recommendation.action === "Eat" || recommendation.action === "Reduce"),
      ),
    ).toBe(true);
  });

  it("does not force Dessert or Sweet Drink", () => {
    const baseline = applicablePlan([], { calories: 100, proteinG: 50 });
    const migraine = applicablePlan([migraineInsight], { calories: 100, proteinG: 50 });

    for (const key of ["dessert", "sweet_drink"]) {
      expect(migraine.recommendations.find((recommendation) => recommendation.itemKey === key)).toEqual(
        baseline.recommendations.find((recommendation) => recommendation.itemKey === key),
      );
    }
  });

  it("preserves a substantive Eat or Reduce alongside a PMS Add", () => {
    const plan = applicablePlan(
      [
        migraineInsight,
        insight({ id: "menstrual.pms_hunger_support", engine: "menstrual" }),
      ],
      { calories: 50, proteinG: 50 },
    );

    expect(plan.recommendations.find((recommendation) => recommendation.itemKey === "chicken")?.action).toBe(
      "Add",
    );
    expect(plan.recommendations.find((recommendation) => recommendation.itemKey === "rice")?.action).toBe(
      "Reduce",
    );
  });
});

describe("generateOfficeLunchPlan — deterministic output and reasons", () => {
  it("returns equal output for equal inputs", () => {
    const decision = makeDecision([
      insight({ id: "nutrition.protein_first", engine: "nutrition" }),
    ]);
    const context = makeContext();
    const budget = { calories: 300, proteinG: 40 };

    expect(generateOfficeLunchPlan(decision, context, budget)).toEqual(
      generateOfficeLunchPlan(decision, context, budget),
    );
  });

  it("gives every recommendation one non-empty sentence grounded in budget or a retained insight", () => {
    const plan = applicablePlan(
      [insight({ id: "nutrition.protein_first", engine: "nutrition" })],
      { calories: 150, proteinG: 40 },
    );

    for (const recommendation of plan.recommendations) {
      expect(recommendation.reason).toMatch(/^[A-Z].*\.$/);
      expect(recommendation.reason.match(/[.!?](?:\s|$)/g)).toHaveLength(1);
      expect(recommendation.reason).toMatch(/remaining|retained/i);
    }
  });
});
