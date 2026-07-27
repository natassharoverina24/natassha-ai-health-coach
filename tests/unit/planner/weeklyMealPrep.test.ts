import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { EngineInsight } from "@/lib/engines/types";
import { generateMealPlan, rankMealCandidates } from "@/lib/planner/mealPlanner";
import { MEAL_TEMPLATES, type MealSlot } from "@/lib/planner/mealTemplates";
import type { PlannerUserContext } from "@/lib/planner/plannerTypes";
import {
  generateWeeklyMealPrep,
  type ApprovedIngredientCatalogue,
  type ApprovedIngredientEntry,
  type WeeklyMealPrepInput,
  type WeeklyMealPrepResult,
} from "@/lib/planner/weeklyMealPrep";
import { DEFAULT_GOALS } from "@/lib/utils/constants";

const SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];

function insight(id: string, engine: EngineInsight["engine"]): EngineInsight {
  return {
    id,
    engine,
    priority: "medium",
    urgency: "soon",
    tone: "neutral",
    summary: "Synthetic retained insight.",
    reason: "Synthetic test reason.",
    recommendedAction: "Use the retained rule.",
  };
}

function makeDecision(insights: EngineInsight[] = []): CoachDecision {
  return {
    insights,
    suppressedEngineNames: [],
    generatedAt: "2026-07-25T06:00:00.000Z",
  };
}

function makeContext(overrides: Partial<PlannerUserContext> = {}): PlannerUserContext {
  return {
    today: "2026-07-25",
    currentHour: 6,
    currentMinute: 0,
    leaveHomeTime: "06:30",
    arriveHomeTime: "19:00",
    lunchProvidedByOffice: false,
    calorieGoal: DEFAULT_GOALS.calorieGoal,
    proteinGoalG: DEFAULT_GOALS.proteinGoalG,
    waterGoalMl: DEFAULT_GOALS.waterGoalMl,
    workoutGoalMinPerDay: DEFAULT_GOALS.workoutGoalMinPerDay,
    stepsGoal: DEFAULT_GOALS.stepsGoal,
    sleepGoalHours: DEFAULT_GOALS.sleepGoalHours,
    ...overrides,
  };
}

function syntheticCatalogue(
  entryFactory: (templateId: string, index: number) => readonly ApprovedIngredientEntry[] =
    (templateId, index) => [
      {
        id: `synthetic-${templateId}`,
        label: `Synthetic approved item ${index}`,
        category: "staples",
        quantity: 1,
        unit: "test-unit",
        catalogueOrder: index,
      },
    ],
): ApprovedIngredientCatalogue {
  return Object.fromEntries(
    MEAL_TEMPLATES.map((template, index) => [
      template.id,
      entryFactory(template.id, index),
    ]),
  );
}

function makeInput(
  overrides: Partial<WeeklyMealPrepInput> = {},
): WeeklyMealPrepInput {
  return {
    decision: makeDecision(),
    context: makeContext(),
    officeLunchByDate: {},
    ingredientCatalogue: syntheticCatalogue(),
    ...overrides,
  };
}

function expectSuccess(result: WeeklyMealPrepResult) {
  expect(result.status).toBe("success");
  if (result.status !== "success") {
    throw new Error("Expected a successful weekly meal prep result.");
  }
  return result;
}

function templateIds(result: ReturnType<typeof expectSuccess>): string[] {
  return result.days.flatMap((day) =>
    SLOTS.map((slot) => day.mealPlan[slot].template.id),
  );
}

describe("generateWeeklyMealPrep", () => {
  it("creates seven consecutive dates across month and year rollover", () => {
    const result = expectSuccess(
      generateWeeklyMealPrep(
        makeInput({ context: makeContext({ today: "2026-12-29" }) }),
      ),
    );

    expect(result.days.map(({ date }) => date)).toEqual([
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
      "2027-01-04",
    ]);
    expect(result.startDate).toBe("2026-12-29");
    expect(result.endDate).toBe("2027-01-04");
  });

  it("returns all four meal slots for every day without within-day duplicates", () => {
    const result = expectSuccess(generateWeeklyMealPrep(makeInput()));

    for (const day of result.days) {
      expect(Object.keys(day.mealPlan).sort()).toEqual([...SLOTS].sort());
      const ids = SLOTS.map((slot) => day.mealPlan[slot].template.id);
      expect(new Set(ids).size).toBe(4);
    }
  });

  it("applies office lunch by exact date and defaults missing dates to false", () => {
    const officeDate = "2026-07-27";
    const result = expectSuccess(
      generateWeeklyMealPrep(
        makeInput({ officeLunchByDate: { [officeDate]: true } }),
      ),
    );

    expect(result.days.map((day) => day.officeLunchProvided)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    const expectedFirstCandidate = rankMealCandidates(
      makeDecision(),
      makeContext({ today: officeDate, lunchProvidedByOffice: true }),
      "lunch",
    )[0].template.id;
    expect(result.days[2].mealPlan.lunch.template.id).toBe(expectedFirstCandidate);
  });

  it("is deterministic and reuses existing Meal Planner ranking", () => {
    const input = makeInput();
    const first = expectSuccess(generateWeeklyMealPrep(input));
    const second = expectSuccess(generateWeeklyMealPrep(input));
    const ordinaryDayOne = generateMealPlan(input.decision, {
      ...input.context,
      lunchProvidedByOffice: false,
    });

    expect(first).toEqual(second);
    for (const slot of SLOTS) {
      expect(first.days[0].mealPlan[slot]).toEqual(ordinaryDayOne[slot]);
    }
  });

  it("keeps strict variety when alternatives are sufficient", () => {
    const result = expectSuccess(generateWeeklyMealPrep(makeInput()));
    const counts = new Map<string, number>();

    for (let dayIndex = 0; dayIndex < result.days.length; dayIndex += 1) {
      for (const slot of SLOTS) {
        const id = result.days[dayIndex].mealPlan[slot].template.id;
        counts.set(id, (counts.get(id) ?? 0) + 1);
        if (dayIndex > 0) {
          expect(id).not.toBe(
            result.days[dayIndex - 1].mealPlan[slot].template.id,
          );
        }
      }
    }
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  });

  it("first allows a third use while preserving same-slot non-consecutive variety", () => {
    const decision = makeDecision([
      insight("migraine.active_symptom_care", "migraine"),
    ]);
    const result = expectSuccess(
      generateWeeklyMealPrep(makeInput({ decision })),
    );
    const counts = new Map<string, number>();

    for (let dayIndex = 0; dayIndex < result.days.length; dayIndex += 1) {
      for (const slot of SLOTS) {
        const id = result.days[dayIndex].mealPlan[slot].template.id;
        counts.set(id, (counts.get(id) ?? 0) + 1);
        if (dayIndex > 0) {
          expect(id).not.toBe(
            result.days[dayIndex - 1].mealPlan[slot].template.id,
          );
        }
      }
    }
    expect([...counts.values()].some((count) => count >= 3)).toBe(true);
  });

  it("allows consecutive same-slot repetition only when the ranked pools require it", () => {
    const originalTemplates = [...MEAL_TEMPLATES];
    const constrainedIds = [
      "oatmeal-banana",
      "chicken-rice-veg",
      "fish-rice-veg",
      "boiled-eggs-snack",
    ];
    const constrainedTemplates = originalTemplates.filter((template) =>
      constrainedIds.includes(template.id),
    );

    try {
      MEAL_TEMPLATES.splice(0, MEAL_TEMPLATES.length, ...constrainedTemplates);
      const result = expectSuccess(
        generateWeeklyMealPrep(
          makeInput({ ingredientCatalogue: syntheticCatalogue() }),
        ),
      );

      expect(
        result.days.slice(1).some(
          (day, index) =>
            day.mealPlan.breakfast.template.id ===
            result.days[index].mealPlan.breakfast.template.id,
        ),
      ).toBe(true);
    } finally {
      MEAL_TEMPLATES.splice(0, MEAL_TEMPLATES.length, ...originalTemplates);
    }
  });

  it("returns missing-template-ingredients without parsing template text", () => {
    const result = generateWeeklyMealPrep(
      makeInput({ ingredientCatalogue: {} }),
    );

    expect(result.status).toBe("invalid-input");
    if (result.status === "invalid-input") {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.every(
          (error) => error.code === "missing-template-ingredients",
        ),
      ).toBe(true);
      for (const error of result.errors) {
        expect(Object.keys(error).sort()).toEqual(["code", "templateId"]);
      }
    }
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects the invalid synthetic ingredient quantity %s",
    (quantity) => {
      const catalogue = syntheticCatalogue((templateId, index) => [
        {
          id: `synthetic-${templateId}`,
          label: `Synthetic approved item ${index}`,
          category: "protein",
          quantity,
          unit: "test-unit",
          catalogueOrder: index,
        },
      ]);
      const result = generateWeeklyMealPrep(makeInput({ ingredientCatalogue: catalogue }));

      expect(result.status).toBe("invalid-input");
      if (result.status === "invalid-input") {
        expect(result.errors.some(({ code }) => code === "invalid-ingredient-quantity")).toBe(true);
      }
    },
  );

  it("rejects inconsistent metadata for matching ingredient IDs", () => {
    const catalogue = syntheticCatalogue((templateId) => [
      {
        id: "shared-approved-id",
        label: templateId === "eggs-toast" ? "Approved label A" : "Approved label B",
        category: "protein",
        quantity: 1,
        unit: "portion",
        catalogueOrder: 1,
      },
    ]);
    const result = generateWeeklyMealPrep(makeInput({ ingredientCatalogue: catalogue }));

    expect(result).toEqual({
      status: "invalid-input",
      errors: [
        {
          code: "inconsistent-ingredient-metadata",
          ingredientId: "shared-approved-id",
        },
      ],
    });
  });

  it("keeps different units separate and never converts them", () => {
    const catalogue = syntheticCatalogue(() => [
      {
        id: "shared-staple",
        label: "Approved staple",
        category: "staples",
        quantity: 1,
        unit: "unit-a",
        catalogueOrder: 1,
      },
      {
        id: "shared-staple",
        label: "Approved staple",
        category: "staples",
        quantity: 2,
        unit: "unit-b",
        catalogueOrder: 1,
      },
    ]);
    const result = expectSuccess(
      generateWeeklyMealPrep(makeInput({ ingredientCatalogue: catalogue })),
    );

    expect(result.shoppingList.map(({ unit, quantity }) => ({ unit, quantity }))).toEqual([
      { unit: "unit-a", quantity: 28 },
      { unit: "unit-b", quantity: 56 },
    ]);
  });

  it("sorts shopping deterministically by category then catalogue order", () => {
    const catalogue = syntheticCatalogue(() => [
      { id: "staple", label: "Staple", category: "staples", quantity: 1, unit: "u", catalogueOrder: 0 },
      { id: "fruit", label: "Fruit", category: "fruit", quantity: 1, unit: "u", catalogueOrder: 9 },
      { id: "protein-b", label: "Protein B", category: "protein", quantity: 1, unit: "u", catalogueOrder: 2 },
      { id: "snack", label: "Snack", category: "healthy_snacks", quantity: 1, unit: "u", catalogueOrder: 0 },
      { id: "vegetable", label: "Vegetable", category: "vegetables", quantity: 1, unit: "u", catalogueOrder: 0 },
      { id: "protein-a", label: "Protein A", category: "protein", quantity: 1, unit: "u", catalogueOrder: 1 },
    ]);
    const first = expectSuccess(
      generateWeeklyMealPrep(makeInput({ ingredientCatalogue: catalogue })),
    );
    const second = expectSuccess(
      generateWeeklyMealPrep(makeInput({ ingredientCatalogue: catalogue })),
    );

    expect(first.shoppingList.map(({ id }) => id)).toEqual([
      "protein-a",
      "protein-b",
      "vegetable",
      "fruit",
      "snack",
      "staple",
    ]);
    expect(second.shoppingList).toEqual(first.shoppingList);
  });

  it("creates batch opportunities only for repeated protein and staples", () => {
    const categories: ApprovedIngredientEntry["category"][] = [
      "protein",
      "vegetables",
      "fruit",
      "healthy_snacks",
      "staples",
    ];
    const catalogue = syntheticCatalogue(() =>
      categories.map((category, index) => ({
        id: `shared-${category}`,
        label: `Approved ${category}`,
        category,
        quantity: 1,
        unit: "portion",
        catalogueOrder: index,
      })),
    );
    const result = expectSuccess(
      generateWeeklyMealPrep(makeInput({ ingredientCatalogue: catalogue })),
    );

    expect(result.batchCookingOpportunities.map(({ ingredientId }) => ingredientId)).toEqual([
      "shared-protein",
      "shared-staples",
    ]);
    for (const opportunity of result.batchCookingOpportunities) {
      expect(opportunity.occurrenceCount).toBe(28);
      expect(opportunity.occurrenceDates).toEqual(
        result.days.map(({ date }) => date),
      );
    }
  });

  it("does not mutate the decision, context, office dates, catalogue, or templates", () => {
    const input = makeInput({
      officeLunchByDate: { "2026-07-25": true },
    });
    const inputSnapshot = JSON.parse(JSON.stringify(input));
    const templatesSnapshot = JSON.parse(JSON.stringify(MEAL_TEMPLATES));

    generateWeeklyMealPrep(input);

    expect(input).toEqual(inputSnapshot);
    expect(MEAL_TEMPLATES).toEqual(templatesSnapshot);
  });

  it("keeps Thyroid neutral while preserving Migraine and other retained rules", () => {
    const migraineAndProtein = [
      insight("migraine.active_symptom_care", "migraine"),
      insight("nutrition.protein_first", "nutrition"),
    ];
    const withoutThyroid = expectSuccess(
      generateWeeklyMealPrep(
        makeInput({ decision: makeDecision(migraineAndProtein) }),
      ),
    );
    const withThyroid = expectSuccess(
      generateWeeklyMealPrep(
        makeInput({
          decision: makeDecision([
            insight("thyroid.deficit_too_aggressive", "thyroid"),
            ...migraineAndProtein,
          ]),
        }),
      ),
    );

    expect(templateIds(withThyroid)).toEqual(templateIds(withoutThyroid));
    for (const day of withThyroid.days) {
      for (const slot of SLOTS) {
        expect(day.mealPlan[slot].template.tags).toContain("migraine-safe");
        expect(day.mealPlan[slot].reason).toMatch(/^Migraine-safe choice/);
        expect(day.mealPlan[slot].reason).not.toMatch(
          /thyroid|medical|supplement|medication/i,
        );
      }
    }
  });
});
