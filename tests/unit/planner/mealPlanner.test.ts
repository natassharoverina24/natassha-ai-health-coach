import {
  detectActiveConstraints,
  distributeTargets,
  generateMealPlan,
  rankMealCandidates,
} from "@/lib/planner/mealPlanner";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { EngineInsight } from "@/lib/engines/types";
import { MEAL_TEMPLATES } from "@/lib/planner/mealTemplates";
import type { PlannerUserContext } from "@/lib/planner/plannerTypes";
import { DEFAULT_GOALS } from "@/lib/utils/constants";

function insight(overrides: Partial<EngineInsight>): EngineInsight {
  return {
    id: "test.insight",
    engine: "behavior",
    priority: "medium",
    urgency: "soon",
    tone: "neutral",
    summary: "Something happened.",
    reason: "Because of reasons.",
    recommendedAction: "Do a thing.",
    ...overrides,
  };
}

function makeDecision(insights: EngineInsight[]): CoachDecision {
  return { insights, suppressedEngineNames: [], generatedAt: "2026-07-25T06:00:00.000Z" };
}

function makeContext(overrides: Partial<PlannerUserContext> = {}): PlannerUserContext {
  return {
    today: "2026-07-25",
    currentHour: 6,
    currentMinute: 0,
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

// ---------------------------------------------------------------------------
// detectActiveConstraints
// ---------------------------------------------------------------------------

describe("detectActiveConstraints", () => {
  it("detects the three food-selection constraint signals from insight IDs", () => {
    const constraints = detectActiveConstraints([
      insight({ id: "thyroid.deficit_too_aggressive", engine: "thyroid" }),
      insight({ id: "migraine.active_symptom_care", engine: "migraine" }),
      insight({ id: "menstrual.pms_hunger_support", engine: "menstrual" }),
      insight({ id: "nutrition.protein_first", engine: "nutrition" }),
    ]);
    expect(constraints).toEqual({
      migraineActive: true,
      pmsActive: true,
      proteinPriority: true,
    });
  });

  it("returns all false when no relevant insights are present", () => {
    const constraints = detectActiveConstraints([
      insight({ id: "behavior.consistency_reinforcement" }),
    ]);
    expect(constraints).toEqual({
      migraineActive: false,
      pmsActive: false,
      proteinPriority: false,
    });
  });

  it("handles an empty insight list", () => {
    const constraints = detectActiveConstraints([]);
    expect(constraints).toEqual({
      migraineActive: false,
      pmsActive: false,
      proteinPriority: false,
    });
  });
});

// ---------------------------------------------------------------------------
// distributeTargets
// ---------------------------------------------------------------------------

describe("distributeTargets", () => {
  it("distributes calories and protein across four slots, totaling close to the full goal (rounding may add ±1)", () => {
    const budgets = distributeTargets(1400, 110, true);
    const totalCal = budgets.breakfast.calories + budgets.lunch.calories + budgets.snack.calories + budgets.dinner.calories;
    const totalPro = budgets.breakfast.proteinG + budgets.lunch.proteinG + budgets.snack.proteinG + budgets.dinner.proteinG;
    expect(totalCal).toBeGreaterThanOrEqual(1399);
    expect(totalCal).toBeLessThanOrEqual(1401);
    expect(totalPro).toBeGreaterThanOrEqual(109);
    expect(totalPro).toBeLessThanOrEqual(111);
  });

  it("gives lunch the largest share on office-lunch days", () => {
    const budgets = distributeTargets(1400, 110, true);
    expect(budgets.lunch.calories).toBeGreaterThanOrEqual(budgets.breakfast.calories);
    expect(budgets.lunch.calories).toBeGreaterThanOrEqual(budgets.snack.calories);
  });

  it("shifts more toward breakfast on non-office days", () => {
    const office = distributeTargets(1400, 110, true);
    const home = distributeTargets(1400, 110, false);
    expect(home.breakfast.calories).toBeGreaterThan(office.breakfast.calories);
  });

  it("always gives snack the smallest share", () => {
    for (const officeLunch of [true, false]) {
      const budgets = distributeTargets(1400, 110, officeLunch);
      expect(budgets.snack.calories).toBeLessThan(budgets.breakfast.calories);
      expect(budgets.snack.calories).toBeLessThan(budgets.lunch.calories);
      expect(budgets.snack.calories).toBeLessThan(budgets.dinner.calories);
    }
  });
});

// ---------------------------------------------------------------------------
// generateMealPlan — normal day
// ---------------------------------------------------------------------------

describe("generateMealPlan — normal day (no active constraints)", () => {
  it("exposes the same ranked candidate that generateMealPlan selects", () => {
    const decision = makeDecision([]);
    const context = makeContext();
    const ranked = rankMealCandidates(decision, context, "breakfast");
    const plan = generateMealPlan(decision, context);

    expect(ranked[0].template.id).toBe(plan.breakfast.template.id);
    expect(ranked[0].reason).toBe(plan.breakfast.reason);
    expect(ranked).toEqual(
      [...ranked].sort(
        (a, b) => b.score - a.score || a.catalogueOrder - b.catalogueOrder,
      ),
    );
  });

  it("produces a recommendation for every slot", () => {
    const plan = generateMealPlan(makeDecision([]), makeContext());
    expect(plan.breakfast.slot).toBe("breakfast");
    expect(plan.lunch.slot).toBe("lunch");
    expect(plan.snack.slot).toBe("snack");
    expect(plan.dinner.slot).toBe("dinner");
  });

  it("selects templates whose slot list matches the assigned slot", () => {
    const plan = generateMealPlan(makeDecision([]), makeContext());
    expect(plan.breakfast.template.slots).toContain("breakfast");
    expect(plan.lunch.template.slots).toContain("lunch");
    expect(plan.snack.template.slots).toContain("snack");
    expect(plan.dinner.template.slots).toContain("dinner");
  });

  it("provides a non-empty reason for every recommendation", () => {
    const plan = generateMealPlan(makeDecision([]), makeContext());
    expect(plan.breakfast.reason.length).toBeGreaterThan(0);
    expect(plan.lunch.reason.length).toBeGreaterThan(0);
    expect(plan.snack.reason.length).toBeGreaterThan(0);
    expect(plan.dinner.reason.length).toBeGreaterThan(0);
  });

  it("avoids repeating the same template across slots (meal variety, §9)", () => {
    const plan = generateMealPlan(makeDecision([]), makeContext());
    const ids = [
      plan.breakfast.template.id,
      plan.lunch.template.id,
      plan.snack.template.id,
      plan.dinner.template.id,
    ];
    expect(new Set(ids).size).toBe(4);
  });

  it("preserves the established non-Thyroid template ranking", () => {
    const plan = generateMealPlan(makeDecision([]), makeContext());
    expect([
      plan.breakfast.template.id,
      plan.lunch.template.id,
      plan.snack.template.id,
      plan.dinner.template.id,
    ]).toEqual([
      "oatmeal-banana",
      "chicken-rice-veg",
      "edamame-snack",
      "fish-rice-veg",
    ]);
  });
});

// ---------------------------------------------------------------------------
// generateMealPlan — Thyroid safety (Priority 1)
// ---------------------------------------------------------------------------

describe("generateMealPlan — Thyroid deficit guardrail neutrality", () => {
  const thyroidInsight = insight({
    id: "thyroid.deficit_too_aggressive",
    engine: "thyroid",
  });

  function recommendations(plan: ReturnType<typeof generateMealPlan>) {
    return [plan.breakfast, plan.lunch, plan.snack, plan.dinner];
  }

  it("selects the same template IDs with and without Thyroid", () => {
    const withoutThyroid = generateMealPlan(makeDecision([]), makeContext());
    const withThyroid = generateMealPlan(makeDecision([thyroidInsight]), makeContext());

    expect(recommendations(withThyroid).map((rec) => rec.template.id)).toEqual(
      recommendations(withoutThyroid).map((rec) => rec.template.id),
    );
  });

  it("does not reduce total selected calories", () => {
    const withoutThyroid = generateMealPlan(makeDecision([]), makeContext());
    const withThyroid = generateMealPlan(makeDecision([thyroidInsight]), makeContext());
    const totalCalories = (plan: ReturnType<typeof generateMealPlan>) =>
      recommendations(plan).reduce((sum, rec) => sum + rec.template.calories, 0);

    expect(totalCalories(withThyroid)).toBe(totalCalories(withoutThyroid));
  });

  it("does not make templates above 115% of a slot budget ineligible", () => {
    const context = makeContext({ calorieGoal: 500 });
    const plan = generateMealPlan(makeDecision([thyroidInsight]), context);
    const budgets = distributeTargets(context.calorieGoal, context.proteinGoalG, true);

    expect(
      recommendations(plan).some(
        (rec) => rec.template.calories > budgets[rec.slot].calories * 1.15,
      ),
    ).toBe(true);
  });

  it("generates no Thyroid, restriction, supplement, medication, or medical rationale", () => {
    const plan = generateMealPlan(makeDecision([thyroidInsight]), makeContext());
    const prohibited =
      /thyroid|lighter|supplements?|medication|medical|iodine|selenium|gluten|soy|cruciferous/i;

    for (const rec of recommendations(plan)) {
      expect(rec.reason).not.toMatch(prohibited);
    }
  });

  it("preserves the Migraine rationale when both insights are retained", () => {
    const plan = generateMealPlan(
      makeDecision([
        thyroidInsight,
        insight({ id: "migraine.active_symptom_care", engine: "migraine" }),
      ]),
      makeContext(),
    );

    for (const rec of recommendations(plan)) {
      expect(rec.template.tags).toContain("migraine-safe");
      expect(rec.reason).toMatch(/^Migraine-safe choice/);
    }
  });

  it("adds no required or preferred food tags and introduces no named-food restriction", () => {
    const withoutThyroid = generateMealPlan(makeDecision([]), makeContext());
    const withThyroid = generateMealPlan(makeDecision([thyroidInsight]), makeContext());

    expect(recommendations(withThyroid).map((rec) => rec.template)).toEqual(
      recommendations(withoutThyroid).map((rec) => rec.template),
    );
  });

  it("does not mutate inputs or MEAL_TEMPLATES", () => {
    const decision = makeDecision([thyroidInsight]);
    const context = makeContext();
    const decisionSnapshot = JSON.parse(JSON.stringify(decision));
    const contextSnapshot = JSON.parse(JSON.stringify(context));
    const templatesSnapshot = JSON.parse(JSON.stringify(MEAL_TEMPLATES));

    generateMealPlan(decision, context);

    expect(decision).toEqual(decisionSnapshot);
    expect(context).toEqual(contextSnapshot);
    expect(MEAL_TEMPLATES).toEqual(templatesSnapshot);
  });
});

// ---------------------------------------------------------------------------
// generateMealPlan — Migraine safety (Priority 2)
// ---------------------------------------------------------------------------

describe("generateMealPlan — migraine active (Priority 2)", () => {
  it("selects migraine-safe templates for every slot", () => {
    const plan = generateMealPlan(
      makeDecision([insight({ id: "migraine.active_symptom_care", engine: "migraine" })]),
      makeContext(),
    );
    for (const rec of [plan.breakfast, plan.lunch, plan.snack, plan.dinner]) {
      expect(rec.template.tags).toContain("migraine-safe");
    }
  });
});

// ---------------------------------------------------------------------------
// generateMealPlan — PMS adjustments (Priority 3)
// ---------------------------------------------------------------------------

describe("generateMealPlan — PMS active (Priority 3)", () => {
  it("favors pms-friendly or fiber-forward snacks", () => {
    const plan = generateMealPlan(
      makeDecision([insight({ id: "menstrual.pms_hunger_support", engine: "menstrual" })]),
      makeContext(),
    );
    const snackTags = plan.snack.template.tags;
    const hasPmsTag = snackTags.includes("pms-friendly") || snackTags.includes("fiber-forward");
    expect(hasPmsTag).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateMealPlan — Protein priority (Priority 4)
// ---------------------------------------------------------------------------

describe("generateMealPlan — protein priority active", () => {
  it("favors high-protein templates across all slots", () => {
    const plan = generateMealPlan(
      makeDecision([insight({ id: "nutrition.protein_first", engine: "nutrition" })]),
      makeContext(),
    );
    const highProteinCount = [plan.breakfast, plan.lunch, plan.snack, plan.dinner].filter(
      (rec) => rec.template.tags.includes("high-protein"),
    ).length;
    // At least 2 of 4 slots should pick a high-protein option when
    // protein priority is active (the scoring bonus steers this).
    expect(highProteinCount).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// generateMealPlan — combined constraints
// ---------------------------------------------------------------------------

describe("generateMealPlan — migraine + PMS combined", () => {
  it("satisfies migraine-safe (higher priority) on all slots while also favoring PMS tags on snacks", () => {
    const plan = generateMealPlan(
      makeDecision([
        insight({ id: "migraine.active_symptom_care", engine: "migraine" }),
        insight({ id: "menstrual.pms_hunger_support", engine: "menstrual" }),
      ]),
      makeContext(),
    );
    for (const rec of [plan.breakfast, plan.lunch, plan.snack, plan.dinner]) {
      expect(rec.template.tags).toContain("migraine-safe");
    }
    const snackTags = plan.snack.template.tags;
    expect(snackTags.includes("pms-friendly") || snackTags.includes("fiber-forward")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateMealPlan — custom goals
// ---------------------------------------------------------------------------

describe("generateMealPlan — custom calorie/protein goals", () => {
  it("adapts to a higher calorie goal without breaking", () => {
    const plan = generateMealPlan(
      makeDecision([]),
      makeContext({ calorieGoal: 2000, proteinGoalG: 150 }),
    );
    expect(plan.breakfast.template.calories).toBeGreaterThan(0);
    expect(plan.dinner.template.calories).toBeGreaterThan(0);
  });

  it("adapts to a lower calorie goal without breaking", () => {
    const plan = generateMealPlan(
      makeDecision([]),
      makeContext({ calorieGoal: 1000, proteinGoalG: 80 }),
    );
    expect(plan.breakfast.template.calories).toBeGreaterThan(0);
    expect(plan.dinner.template.calories).toBeGreaterThan(0);
  });
});
