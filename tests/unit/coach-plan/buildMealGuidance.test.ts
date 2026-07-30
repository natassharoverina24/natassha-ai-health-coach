import { buildMealGuidance } from "@/lib/coach-plan/buildMealGuidance";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import {
  generateDailyPlan,
  generateMealPlan,
  generateOfficeLunchPlan,
  MEAL_TEMPLATES,
  type PlannerUserContext,
} from "@/lib/planner";
import type { MealEntry } from "@/types/firestore";

const decision: CoachDecision = {
  insights: [],
  suppressedEngineNames: [],
  generatedAt: "2026-07-30T08:00:00.000Z",
};

const context: PlannerUserContext = {
  today: "2026-07-30",
  currentHour: 8,
  currentMinute: 0,
  leaveHomeTime: "06:30",
  arriveHomeTime: "19:00",
  lunchProvidedByOffice: true,
  calorieGoal: 1400,
  proteinGoalG: 110,
  waterGoalMl: 2000,
  workoutGoalMinPerDay: 30,
  stepsGoal: 8000,
  sleepGoalHours: 7,
};

function mealLog(
  id: string,
  type: MealEntry["type"],
  calories: number,
  proteinG: number,
): MealEntry {
  return {
    id,
    userId: "user-1",
    date: context.today,
    type,
    name: "Confirmed structured meal",
    quantity: null,
    isOfficeLunch: false,
    macros: {
      calories,
      proteinG,
      carbsG: 20,
      fatG: 8,
      fiberG: 2,
    },
    photoIds: [],
    score: null,
    note: null,
    createdAt: "2026-07-30T08:00:00.000Z",
    updatedAt: "2026-07-30T08:00:00.000Z",
  };
}

function build(
  mealLogs: readonly MealEntry[] | null = [],
  officeLunchPlan: ReturnType<typeof generateOfficeLunchPlan> | null = null,
) {
  const dailyPlan = generateDailyPlan(decision, context);
  const mealPlan = generateMealPlan(decision, context);
  return {
    dailyPlan,
    mealPlan,
    result: buildMealGuidance({
      decision,
      context,
      dailyPlan,
      mealPlan,
      mealLogs,
      officeLunchPlan,
    }),
  };
}

describe("buildMealGuidance", () => {
  it("uses approved template nutrition, schedule, reasons, and alternatives", () => {
    const { dailyPlan, mealPlan, result } = build();
    const approvedIds = new Set(MEAL_TEMPLATES.map((template) => template.id));

    for (const slot of ["breakfast", "lunch", "snack", "dinner"] as const) {
      const guidance = result[slot];
      const template = mealPlan[slot].template;
      expect(guidance).toEqual(
        expect.objectContaining({
          slot,
          scheduledTime: dailyPlan.schedule[slot].time,
          recommendation: {
            templateId: template.id,
            name: template.name,
            servingText: template.serving,
          },
          nutrition: {
            caloriesKcal: template.calories,
            proteinG: template.proteinG,
            carbohydrateG: template.carbsG,
            fatG: template.fatG,
          },
          why: expect.arrayContaining([mealPlan[slot].reason]),
          sourceIds: expect.arrayContaining([
            `planner.meal.${slot}`,
            `meal-template:${template.id}`,
          ]),
        }),
      );
      expect(guidance.alternatives).toHaveLength(2);
      expect(
        guidance.alternatives.every(
          (alternative) =>
            approvedIds.has(alternative.templateId) &&
            alternative.templateId !== template.id,
        ),
      ).toBe(true);
    }
  });

  it("uses confirmed logs for sequential remaining calorie and protein targets", () => {
    const breakfastLogs = [
      mealLog("breakfast-1", "breakfast", 200, 15),
      mealLog("breakfast-2", "breakfast", 100, 5),
    ];
    const { mealPlan, result } = build(breakfastLogs);

    expect(result.breakfast.confirmedConsumption).toEqual(
      expect.objectContaining({
        entryCount: 2,
        nutrition: expect.objectContaining({
          caloriesKcal: 300,
          proteinG: 20,
        }),
        sourceIds: ["meal-log:breakfast-1", "meal-log:breakfast-2"],
      }),
    );
    expect(result.breakfast.remainingAfterMeal).toEqual({
      caloriesKcal: 1100,
      proteinG: 90,
    });
    expect(result.lunch.remainingAfterMeal).toEqual({
      caloriesKcal: Math.max(0, 1100 - mealPlan.lunch.template.calories),
      proteinG: Math.max(0, 90 - mealPlan.lunch.template.proteinG),
    });
    expect(result.lunch.nextMealImpact).toContain(
      `${result.lunch.remainingAfterMeal.caloriesKcal} kcal`,
    );
  });

  it("falls back to planned template values when meal logs are unavailable", () => {
    const { mealPlan, result } = build(null);

    expect(result.breakfast.confirmedConsumption).toBeNull();
    expect(result.breakfast.remainingAfterMeal.caloriesKcal).toBe(
      context.calorieGoal - mealPlan.breakfast.template.calories,
    );
  });

  it("does not count unresolved meal logs in confirmed nutrition", () => {
    const { result } = build([
      mealLog("rice", "lunch", 200, 4),
      mealLog("unresolved-soto", "lunch", 0, 0),
    ]);

    expect(result.lunch.confirmedConsumption).toMatchObject({
      entryCount: 1,
      nutrition: {
        caloriesKcal: 200,
        proteinG: 4,
        carbohydrateG: 20,
        fatG: 8,
      },
      sourceIds: ["meal-log:rice"],
    });
  });

  it("embeds Office Lunch Optimizer output only in lunch guidance", () => {
    const officeLunchPlan = generateOfficeLunchPlan(decision, context, {
      calories: 700,
      proteinG: 50,
    });
    const { result } = build([], officeLunchPlan);

    expect(result.breakfast.officeLunchAdjustment).toBeNull();
    expect(result.lunch.officeLunchAdjustment).toEqual({
      plan: officeLunchPlan,
      sourceIds: ["planner.office-lunch"],
    });
    expect(result.snack.officeLunchAdjustment).toBeNull();
    expect(result.dinner.officeLunchAdjustment).toBeNull();
  });

  it("is deterministic, non-mutating, and contains no fabricated guidance", () => {
    const logs = [mealLog("breakfast-1", "breakfast", 300, 18)];
    const frozenLogs = JSON.parse(JSON.stringify(logs)) as MealEntry[];
    const first = build(logs).result;
    const second = build(logs).result;

    expect(second).toEqual(first);
    expect(logs).toEqual(frozenLogs);
    expect(JSON.stringify(first)).not.toMatch(
      /diagnos|medical advice|thyroid restriction|supplement|medication|gofood/i,
    );
  });
});
