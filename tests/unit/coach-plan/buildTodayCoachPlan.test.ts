import {
  buildCoachDecisionWithAvailability,
  buildPlannerUserContext,
} from "@/lib/ai/contextBuilder";
import {
  buildTodayCoachPlan,
  type MealAlternative,
  type TodayCoachPlanOptions,
} from "@/lib/coach-plan";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { EngineInsight } from "@/lib/engines/types";
import { mealsRepository } from "@/lib/db/meals.repository";
import { timelineCompletionsRepository } from "@/lib/db/timelineCompletions.repository";
import { waterLogsRepository } from "@/lib/db/waterLogs.repository";
import { workoutsRepository } from "@/lib/db/workouts.repository";
import { waistsRepository } from "@/lib/db/waists.repository";
import { activeDisruptionsRepository } from "@/lib/db/activeDisruptions.repository";
import {
  generateDailyPlan,
  generateMealPlan,
  MEAL_TEMPLATES,
  type ApprovedIngredientCatalogue,
  type PlannerUserContext,
} from "@/lib/planner";

jest.mock("@/lib/ai/contextBuilder", () => ({
  buildCoachDecisionWithAvailability: jest.fn(),
  buildPlannerUserContext: jest.fn(),
}));
jest.mock("@/lib/db/meals.repository", () => ({
  mealsRepository: { listForUserByDate: jest.fn() },
}));
jest.mock("@/lib/db/waterLogs.repository", () => ({
  waterLogsRepository: { listForUserByDate: jest.fn() },
}));
jest.mock("@/lib/db/workouts.repository", () => ({
  workoutsRepository: { listForUserByDate: jest.fn() },
}));
jest.mock("@/lib/db/timelineCompletions.repository", () => ({
  timelineCompletionsRepository: { listForUserByDate: jest.fn() },
}));
jest.mock("@/lib/db/waists.repository", () => ({
  waistsRepository: { listForUser: jest.fn() },
}));
jest.mock("@/lib/db/activeDisruptions.repository", () => ({
  activeDisruptionsRepository: { getActiveForUserByDate: jest.fn() },
}));

const proteinInsight: EngineInsight = {
  id: "nutrition.protein_first",
  engine: "nutrition",
  priority: "high",
  urgency: "soon",
  tone: "encouraging",
  summary: "Protein is below the retained target.",
  reason: "The logged protein total is below the retained target.",
  recommendedAction: "Use the retained protein-first action.",
};

const hydrationInsight: EngineInsight = {
  id: "adaptive.low_hydration_pattern",
  engine: "adaptiveLearning",
  priority: "medium",
  urgency: "soon",
  tone: "neutral",
  summary: "A retained hydration pattern is active.",
  reason: "The Decision Engine retained the hydration pattern.",
  recommendedAction: "Use the retained reminder adjustment.",
};

const decision: CoachDecision = {
  insights: [proteinInsight, hydrationInsight],
  suppressedEngineNames: [],
  generatedAt: "2026-07-29T08:00:00.000Z",
};

const context: PlannerUserContext = {
  today: "2026-07-29",
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

const syntheticIngredientCatalogue: ApprovedIngredientCatalogue =
  Object.fromEntries(
    MEAL_TEMPLATES.map((template, catalogueOrder) => [
      template.id,
      [
        {
          id: `synthetic-${template.id}`,
          label: `Synthetic approved fixture for ${template.id}`,
          category: "staples" as const,
          quantity: 1,
          unit: "fixture-unit",
          catalogueOrder,
        },
      ],
    ]),
  );

const completeOptions: TodayCoachPlanOptions = {
  remainingNutritionBudget: { calories: 700, proteinG: 55 },
  officeLunchByDate: { "2026-07-29": true },
  ingredientCatalogue: syntheticIngredientCatalogue,
  activeDisruption: {
    id: "user-1__2026-07-29",
    createdAt: decision.generatedAt,
    updatedAt: decision.generatedAt,
    userId: "user-1",
    date: "2026-07-29",
    type: "skipped-meal",
    startedAt: decision.generatedAt,
    note: null,
    status: "active",
    clearedAt: null,
    expectedEndAt: null,
    affectedSlot: null,
    affectedMealSlot: null,
    skippedMealSlot: "breakfast",
    skippedAt: "09:00",
  },
};

const decisionSources = {
  profile: { status: "available", data: {} },
  settings: { status: "empty", data: null },
  currentDateTime: {
    status: "available",
    data: {
      now: decision.generatedAt,
      today: context.today,
      currentHour: context.currentHour,
      currentMinute: context.currentMinute,
    },
  },
  weights: { status: "empty", data: [] },
  meals: { status: "empty", data: [] },
  water: { status: "empty", data: [] },
  workouts: { status: "empty", data: [] },
  sleep: { status: "empty", data: [] },
  cycles: { status: "empty", data: [] },
  motivations: { status: "empty", data: [] },
};

beforeEach(() => {
  (buildCoachDecisionWithAvailability as jest.Mock)
    .mockReset()
    .mockResolvedValue({ decision, sources: decisionSources });
  (buildPlannerUserContext as jest.Mock).mockReset().mockResolvedValue(context);
  (mealsRepository.listForUserByDate as jest.Mock)
    .mockReset()
    .mockResolvedValue([]);
  (waterLogsRepository.listForUserByDate as jest.Mock)
    .mockReset()
    .mockResolvedValue([]);
  (workoutsRepository.listForUserByDate as jest.Mock)
    .mockReset()
    .mockResolvedValue([]);
  (timelineCompletionsRepository.listForUserByDate as jest.Mock)
    .mockReset()
    .mockResolvedValue([]);
  (waistsRepository.listForUser as jest.Mock)
    .mockReset()
    .mockResolvedValue([]);
  (activeDisruptionsRepository.getActiveForUserByDate as jest.Mock)
    .mockReset()
    .mockResolvedValue(null);
});

describe("buildTodayCoachPlan", () => {
  it("returns the complete traceable TodayCoachPlan structure", async () => {
    const result = await buildTodayCoachPlan("user-1", completeOptions);

    expect(result).toEqual(
      expect.objectContaining({
        generatedAt: decision.generatedAt,
        date: context.today,
        status: "ready",
        greeting: expect.objectContaining({ sourceIds: expect.any(Array) }),
        briefing: expect.objectContaining({ sourceIds: expect.any(Array) }),
        focus: expect.objectContaining({ sourceIds: [proteinInsight.id] }),
        biggestRisk: expect.anything(),
        todaysWin: null,
        timeline: expect.any(Array),
        meals: expect.any(Object),
        metrics: expect.objectContaining({
          coachScore: expect.objectContaining({
            sourceIds: expect.any(Array),
          }),
          calories: expect.objectContaining({
            sourceIds: expect.any(Array),
          }),
          body: expect.any(Object),
        }),
        officeLunch: expect.objectContaining({ sourceIds: expect.any(Array) }),
        emergencyAdjustment: expect.objectContaining({
          sourceIds: expect.any(Array),
        }),
        adaptiveAdjustments: expect.objectContaining({
          sourceIds: expect.arrayContaining([hydrationInsight.id]),
        }),
        weeklyContext: expect.objectContaining({
          sourceIds: expect.any(Array),
        }),
        dataAvailability: {
          decision: "available",
          dailyPlan: "available",
          mealPlan: "available",
          officeLunch: "available",
          emergencyAdjustment: "available",
          adaptiveAdjustments: "available",
          weeklyContext: "available",
          timelineStatus: {
            mealLogs: "empty",
            waterLogs: "empty",
            workoutLogs: "empty",
            manualCompletions: "empty",
          },
          sources: expect.any(Object),
          cache: { status: "empty" },
        },
        warnings: [],
      }),
    );
    expect(result.timeline).toHaveLength(6);
    expect(Object.keys(result.meals)).toEqual([
      "breakfast",
      "lunch",
      "snack",
      "dinner",
    ]);
    expect(result.meals.lunch.officeLunchAdjustment?.plan).toEqual(
      result.officeLunch?.value,
    );
  });

  it("is deterministic for the same decision, context, options, and time", async () => {
    const first = await buildTodayCoachPlan("user-1", completeOptions);
    const second = await buildTodayCoachPlan("user-1", completeOptions);

    expect(second).toEqual(first);
  });

  it("restores the same-day active disruption through the coach plan", async () => {
    const active = completeOptions.activeDisruption!;
    (activeDisruptionsRepository.getActiveForUserByDate as jest.Mock)
      .mockResolvedValue(active);

    const result = await buildTodayCoachPlan("user-1");

    expect(
      activeDisruptionsRepository.getActiveForUserByDate,
    ).toHaveBeenCalledWith("user-1", "2026-07-29");
    expect(result.emergencyAdjustment?.value.type).toBe("skipped-meal");
    expect(result.timeline.some((item) => item.status === "adjusted")).toBe(
      true,
    );
  });

  it("uses the existing daily timeline and meal planner outputs unchanged", async () => {
    const result = await buildTodayCoachPlan("user-1");
    const expectedDaily = generateDailyPlan(decision, context);
    const expectedMeals = generateMealPlan(decision, context);

    expect(
      result.timeline.map(({ kind, label, time }) => ({ kind, label, time })),
    ).toEqual(
      Object.entries(expectedDaily.schedule).map(([kind, slot]) => ({
        kind,
        ...slot,
      })),
    );
    for (const slot of ["breakfast", "lunch", "snack", "dinner"] as const) {
      expect({
        slot: result.meals[slot].slot,
        recommendation: result.meals[slot].recommendation,
        nutrition: result.meals[slot].nutrition,
        reason: result.meals[slot].why[0],
      }).toEqual({
        slot,
        recommendation: {
          templateId: expectedMeals[slot].template.id,
          name: expectedMeals[slot].template.name,
          servingText: expectedMeals[slot].template.serving,
        },
        nutrition: {
          caloriesKcal: expectedMeals[slot].template.calories,
          proteinG: expectedMeals[slot].template.proteinG,
          carbohydrateG: expectedMeals[slot].template.carbsG,
          fatG: expectedMeals[slot].template.fatG,
        },
        reason: expectedMeals[slot].reason,
      });
      expect(result.meals[slot].sourceIds).toContain(proteinInsight.id);
    }
    expect(result.metrics.calories.target).toBe(expectedDaily.targets.calories);
    expect(result.metrics.protein.target).toBe(expectedDaily.targets.proteinG);
    expect(result.metrics.water.target).toBe(expectedDaily.targets.waterMl);
    expect(result.metrics.workout.target).toBe(expectedDaily.targets.workoutMin);
    expect(result.metrics.sleep.target).toBe(expectedDaily.targets.sleepHours);
    expect(result.metrics.coachScore.sourceIds).toContain("coach.daily-score");
  });

  it("uses null and structured availability when optional planner inputs are absent", async () => {
    const result = await buildTodayCoachPlan("user-1");

    expect(result.officeLunch).toBeNull();
    expect(result.weeklyContext).toBeNull();
    expect(result.emergencyAdjustment).toBeNull();
    expect(result.dataAvailability).toEqual(
      expect.objectContaining({
        officeLunch: "unavailable",
        weeklyContext: "unavailable",
        emergencyAdjustment: "not-applicable",
      }),
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "office-lunch-budget-unavailable",
          message: expect.any(String),
          sourceIds: ["planner.office-lunch"],
        }),
        expect.objectContaining({
          code: "weekly-planning-input-unavailable",
          message: expect.any(String),
          sourceIds: ["planner.weekly-meal-prep"],
        }),
      ]),
    );
    expect(result.status).toBe("partial");
    expect(result.timeline).toHaveLength(6);
    expect(Object.keys(result.meals)).toHaveLength(4);
    expect(result.warnings.every((warning) => warning.message.length > 0)).toBe(
      true,
    );
  });

  it("uses confirmed meal-log macros in the remaining nutrition guidance", async () => {
    (mealsRepository.listForUserByDate as jest.Mock).mockResolvedValue([
      {
        id: "confirmed-breakfast",
        type: "breakfast",
        macros: {
          calories: 250,
          proteinG: 20,
          carbsG: 30,
          fatG: 8,
          fiberG: 3,
        },
      },
    ]);

    const result = await buildTodayCoachPlan("user-1");

    expect(result.meals.breakfast.confirmedConsumption).toEqual(
      expect.objectContaining({
        entryCount: 1,
        nutrition: expect.objectContaining({
          caloriesKcal: 250,
          proteinG: 20,
        }),
        sourceIds: ["meal-log:confirmed-breakfast"],
      }),
    );
    expect(result.meals.breakfast.remainingAfterMeal).toEqual({
      caloriesKcal: context.calorieGoal - 250,
      proteinG: context.proteinGoalG - 20,
    });
    expect(result.meals.lunch.nextMealImpact).toContain("kcal");
  });

  it("keeps the core plan when optional office-lunch input is invalid", async () => {
    const result = await buildTodayCoachPlan("user-1", {
      remainingNutritionBudget: {
        calories: Number.NaN,
        proteinG: 55,
      },
    });

    expect(result.status).toBe("partial");
    expect(result.officeLunch).toBeNull();
    expect(result.dataAvailability.officeLunch).toBe("invalid-input");
    expect(result.timeline).toHaveLength(6);
    expect(Object.keys(result.meals)).toHaveLength(4);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "office-lunch-invalid-input",
        sourceIds: ["planner.office-lunch"],
      }),
    );
  });

  it("keeps the timeline available when one optional log source fails", async () => {
    (waterLogsRepository.listForUserByDate as jest.Mock).mockRejectedValue(
      new Error("private Firebase detail"),
    );

    const result = await buildTodayCoachPlan("user-1");

    expect(result.status).toBe("partial");
    expect(result.timeline).toHaveLength(6);
    expect(result.dataAvailability.timelineStatus.waterLogs).toBe(
      "unavailable",
    );
    expect(
      result.timeline.find((item) => item.kind === "waterReminder")?.status,
    ).toBe("pending");
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "timeline-water-logs-unavailable",
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/private Firebase detail/i);
  });

  it("returns a partial plan when an optional decision source is unavailable", async () => {
    (buildCoachDecisionWithAvailability as jest.Mock).mockResolvedValueOnce({
      decision,
      sources: {
        ...decisionSources,
        water: {
          status: "unavailable",
          data: [],
          errorCode: "network",
        },
      },
    });

    const result = await buildTodayCoachPlan("user-1");

    expect(result.status).toBe("partial");
    expect(result.timeline).toHaveLength(6);
    expect(result.dataAvailability.sources.water).toEqual({
      status: "unavailable",
      errorCode: "network",
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "optional-source-unavailable",
        sourceIds: ["repository.water"],
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/firebase|console|private/i);
  });

  it("still rejects when the required profile cannot be verified", async () => {
    (buildCoachDecisionWithAvailability as jest.Mock).mockRejectedValueOnce(
      new Error("The user profile is required to prepare today's plan."),
    );

    await expect(buildTodayCoachPlan("user-1")).rejects.toThrow(
      "user profile is required",
    );
  });

  it("does not fabricate decisions, meal nutrition, or medical content", async () => {
    const result = await buildTodayCoachPlan("user-1");
    const approvedTemplates = new Map(
      MEAL_TEMPLATES.map((template) => [template.id, template]),
    );

    expect(result.briefing.retainedInsights).toEqual(decision.insights);
    expect(result.focus?.value.id).toBe(proteinInsight.id);
    for (const meal of Object.values(result.meals)) {
      const approved = approvedTemplates.get(meal.recommendation.templateId);
      expect(approved).toBeDefined();
      expect(meal.recommendation).toEqual({
        templateId: approved?.id,
        name: approved?.name,
        servingText: approved?.serving,
      });
      expect(meal.nutrition).toEqual({
        caloriesKcal: approved?.calories,
        proteinG: approved?.proteinG,
        carbohydrateG: approved?.carbsG,
        fatG: approved?.fatG,
      });
      expect(meal.alternatives.every((alternative: MealAlternative) =>
        approvedTemplates.has(alternative.templateId),
      )).toBe(true);
    }
    expect(JSON.stringify(result)).not.toMatch(
      /diagnos|medical advice|thyroid diet|thyroid restriction|supplement|medication|gofood/i,
    );
  });
});
