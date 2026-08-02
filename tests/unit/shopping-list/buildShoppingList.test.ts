import type { CoachDecision } from "@/lib/engines/decisionEngine";
import {
  generateWeeklyMealPrep,
  type PlannerUserContext,
  type WeeklyMealPrepDay,
} from "@/lib/planner";
import {
  buildShoppingListFromMealPlan,
  buildBatchCookingOpportunities,
  clearMealReplacementSelection,
  readMealReplacementSelections,
  saveMealReplacementSelection,
} from "@/lib/shopping-list";

const decision: CoachDecision = {
  insights: [],
  suppressedEngineNames: [],
  generatedAt: "2026-08-01T06:00:00.000Z",
};

const context: PlannerUserContext = {
  today: "2026-08-01",
  currentHour: 6,
  currentMinute: 0,
  leaveHomeTime: "06:30",
  arriveHomeTime: "19:00",
  lunchProvidedByOffice: false,
  calorieGoal: 1400,
  proteinGoalG: 100,
  waterGoalMl: 2000,
  workoutGoalMinPerDay: 30,
  stepsGoal: 8000,
  sleepGoalHours: 7,
};

function weeklyDays(): WeeklyMealPrepDay[] {
  const result = generateWeeklyMealPrep({
    decision,
    context,
    officeLunchByDate: {},
    ingredientCatalogue: {},
  });
  if (!result.days) throw new Error("Expected deterministic weekly days.");
  return result.days;
}

describe("buildShoppingListFromMealPlan", () => {
  beforeEach(() => window.localStorage.clear());

  it("converts seven meal-plan days into a categorized shopping list", () => {
    const result = buildShoppingListFromMealPlan({ days: weeklyDays() });

    expect(result.status).toBe("ready");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.map((item) => item.category)).toEqual(
      expect.arrayContaining([
        "protein",
        "carbohydrate",
        "vegetable-fiber",
        "fruit-snack",
      ]),
    );
    expect(result.items.every((item) => item.sourceMeals.length > 0)).toBe(true);
  });

  it("uses a selected replacement instead of the default meal", () => {
    const days = weeklyDays();
    const selectedDate = days[0].date;
    const result = buildShoppingListFromMealPlan({
      days,
      selectedReplacements: [
        {
          userId: "user-1",
          date: selectedDate,
          slot: "breakfast",
          templateId: "eggs-toast",
          label: "Scrambled eggs with toast",
          selectedAt: "2026-08-01T06:10:00.000Z",
        },
      ],
    });

    const replacementSources = result.items.flatMap((item) =>
      item.sourceMeals.filter(
        (source) =>
          source.date === selectedDate && source.slot === "breakfast",
      ),
    );
    expect(replacementSources.length).toBeGreaterThan(0);
    expect(replacementSources.every((source) => source.templateId === "eggs-toast")).toBe(true);
    expect(replacementSources.every((source) => source.selectedReplacement)).toBe(true);
  });

  it("merges duplicate foods and keeps transparent estimated portions", () => {
    const result = buildShoppingListFromMealPlan({ days: weeklyDays() });
    const repeated = result.items.find((item) => item.sourceMeals.length > 1);

    expect(repeated).toBeDefined();
    expect(repeated).toMatchObject({
      estimatedQuantity: expect.any(Number),
      unit: "porsi",
      quantityStatus: "estimated",
      checked: false,
    });
    expect(repeated!.estimatedQuantity).toBe(repeated!.sourceMeals.length);
  });

  it("keeps batch cooking available for repeated known protein or staples", () => {
    const result = buildShoppingListFromMealPlan({ days: weeklyDays() });
    if (result.status === "empty") throw new Error("Expected shopping items.");

    const opportunities = buildBatchCookingOpportunities(result.items);
    expect(opportunities.length).toBeGreaterThan(0);
    expect(
      opportunities.every(
        (item) =>
          item.occurrenceCount >= 2 &&
          ["protein", "carbohydrate", "pantry-basic"].includes(item.category),
      ),
    ).toBe(true);
  });

  it("keeps unknown replacements as a manual-check partial item", () => {
    const days = weeklyDays();
    const result = buildShoppingListFromMealPlan({
      days,
      selectedReplacements: [
        {
          userId: "user-1",
          date: days[0].date,
          slot: "lunch",
          templateId: "custom-family-meal",
          label: "Masakan keluarga",
          selectedAt: "2026-08-01T08:00:00.000Z",
        },
      ],
    });

    expect(result.status).toBe("partial");
    expect(
      result.items.some((item) => item.provenance !== "needs-confirmation"),
    ).toBe(true);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Masakan keluarga",
          category: "pantry-basic",
          estimatedQuantity: null,
          unit: null,
          quantityStatus: "needs-confirmation",
          provenance: "needs-confirmation",
        }),
      ]),
    );
    expect(buildBatchCookingOpportunities(result.items).length).toBeGreaterThan(0);
  });

  it("maps known AI ingredients and marks only unknown ingredients for manual checking", () => {
    const days = weeklyDays();
    const result = buildShoppingListFromMealPlan({
      days,
      selectedReplacements: [
        {
          userId: "user-1",
          date: days[0].date,
          slot: "lunch",
          templateId: "ai-gemini-ayam-daun-lokal",
          label: "Ayam dengan daun lokal",
          selectedAt: "2026-08-01T08:00:00.000Z",
          ingredientIds: ["chicken", "white-rice", "daun-lokal"],
          provenance: "ai-assisted",
          provider: "gemini",
        },
      ],
    });

    expect(result.status).toBe("partial");
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "chicken", provenance: "mixed" }),
        expect.objectContaining({ id: "white-rice", provenance: "mixed" }),
        expect.objectContaining({ name: "daun-lokal", quantityStatus: "needs-confirmation" }),
      ]),
    );
  });

  it("returns a clear empty result and requires no paid provider", () => {
    const result = buildShoppingListFromMealPlan({ days: [] });
    expect(result).toEqual({ status: "empty", items: [], warnings: [] });
    expect(String(buildShoppingListFromMealPlan)).not.toMatch(
      /gemini|groq|openrouter|anthropic|paid/i,
    );
  });

  it("stores one idempotent local replacement per date and slot", () => {
    const selection = {
      userId: "user-1",
      date: "2026-08-01",
      slot: "dinner" as const,
      templateId: "fish-rice-veg",
      label: "Grilled fish with rice & vegetables",
      selectedAt: "2026-08-01T09:00:00.000Z",
    };
    saveMealReplacementSelection(selection);
    saveMealReplacementSelection({ ...selection, selectedAt: "2026-08-01T09:05:00.000Z" });

    expect(readMealReplacementSelections("user-1")).toEqual([
      { ...selection, selectedAt: "2026-08-01T09:05:00.000Z" },
    ]);
    clearMealReplacementSelection("user-1", selection.date, selection.slot);
    expect(readMealReplacementSelections("user-1")).toEqual([]);
  });
});
