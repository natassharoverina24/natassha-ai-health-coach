import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { EngineInsight } from "@/lib/engines/types";
import {
  applyAdaptiveAdjustments,
  type AdaptiveAdjustmentInput,
  type AdaptiveAdjustmentResult,
  type AdaptivePlan,
} from "@/lib/planner/adaptiveAdjustments";
import { generateDailyPlan } from "@/lib/planner/dailyPlanner";
import { generateMealPlan } from "@/lib/planner/mealPlanner";
import { MEAL_TEMPLATES } from "@/lib/planner/mealTemplates";
import type { PlannerUserContext } from "@/lib/planner/plannerTypes";
import { DEFAULT_GOALS } from "@/lib/utils/constants";

function insight(
  id: string,
  recommendedAction = "Apply the retained adaptive adjustment.",
): EngineInsight {
  return {
    id,
    engine: id.startsWith("adaptive.") ? "adaptiveLearning" : "behavior",
    priority: "medium",
    urgency: "none",
    tone: "neutral",
    summary: "A retained pattern.",
    reason: "Confirmed by the existing engine.",
    recommendedAction,
  };
}

function decision(insights: EngineInsight[] = []): CoachDecision {
  return {
    insights,
    suppressedEngineNames: [],
    generatedAt: "2026-07-25T06:00:00.000Z",
  };
}

function context(overrides: Partial<PlannerUserContext> = {}): PlannerUserContext {
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

function plan(
  retainedDecision: CoachDecision = decision(),
  userContext: PlannerUserContext = context(),
  date = userContext.today,
): AdaptivePlan {
  return {
    date,
    dailyPlan: generateDailyPlan(retainedDecision, userContext),
    mealPlan: generateMealPlan(retainedDecision, userContext),
  };
}

function input(
  retainedInsights: EngineInsight[],
  overrides: Partial<AdaptiveAdjustmentInput> = {},
): AdaptiveAdjustmentInput {
  const retainedDecision = decision(retainedInsights);
  return {
    decision: retainedDecision,
    plan: plan(retainedDecision),
    ...overrides,
  };
}

function success(result: AdaptiveAdjustmentResult) {
  expect(result.status).toBe("success");
  if (result.status !== "success") {
    throw new Error("Expected adaptive adjustment success.");
  }
  return result;
}

describe("applyAdaptiveAdjustments", () => {
  it("selects the highest-ranked eligible higher-calorie dinner", () => {
    const result = success(
      applyAdaptiveAdjustments(
        input([insight("adaptive.late_night_hunger_pattern")]),
      ),
    );
    const adjustment = result.adjustments[0];

    expect(adjustment).toMatchObject({
      type: "bigger-dinner",
      reasonInsightId: "adaptive.late_night_hunger_pattern",
    });
    if (result.plan.mealPlan.dinner && !("kind" in result.plan.mealPlan.dinner)) {
      expect(result.plan.mealPlan.dinner.template.id).toBe(
        adjustment.type === "bigger-dinner"
          ? adjustment.selectedTemplateId
          : undefined,
      );
    }
  });

  it("leaves dinner unchanged when no eligible higher-calorie candidate exists", () => {
    const retainedDecision = decision([
      insight("adaptive.late_night_hunger_pattern"),
    ]);
    const adaptivePlan = plan(retainedDecision);
    const highestDinner = MEAL_TEMPLATES.find(
      ({ id }) => id === "nasi-goreng-protein",
    )!;
    adaptivePlan.mealPlan.dinner = {
      slot: "dinner",
      template: highestDinner,
      reason: "Existing approved dinner.",
    };

    expect(
      applyAdaptiveAdjustments({
        plan: adaptivePlan,
        decision: retainedDecision,
      }),
    ).toEqual({
      status: "not-applicable",
      reason: "no-supported-adjustment",
    });
  });

  it("reduces workout duration by 25% and rounds to the nearest five minutes", () => {
    const adaptiveInput = input(
      [insight("adaptive.skipped_workout_day_pattern", "Plan a shorter workout.")],
      {
        plan: plan(
          decision(),
          context({ workoutGoalMinPerDay: 50 }),
        ),
      },
    );
    const result = success(applyAdaptiveAdjustments(adaptiveInput));

    expect(result.plan.dailyPlan.targets.workoutMin).toBe(40);
    expect(result.adjustments).toEqual([
      {
        type: "shorter-workout",
        reasonInsightId: "adaptive.skipped_workout_day_pattern",
        previousMinutes: 50,
        adjustedMinutes: 40,
      },
    ]);
  });

  it("enforces the ten-minute workout minimum without increasing duration", () => {
    const retainedDecision = decision([
      insight("adaptive.skipped_workout_day_pattern", "Plan a shorter workout."),
    ]);
    const twelveMinutePlan = plan(
      retainedDecision,
      context({ workoutGoalMinPerDay: 12 }),
    );
    const result = success(
      applyAdaptiveAdjustments({
        plan: twelveMinutePlan,
        decision: retainedDecision,
      }),
    );

    expect(result.plan.dailyPlan.targets.workoutMin).toBe(10);
  });

  it("moves a workout exactly 60 minutes earlier when explicitly requested", () => {
    const result = success(
      applyAdaptiveAdjustments(
        input([
          insight(
            "adaptive.skipped_workout_day_pattern",
            "Move the workout earlier.",
          ),
        ]),
      ),
    );

    expect(result.adjustments).toEqual(
      expect.arrayContaining([
        {
          type: "moved-workout",
          reasonInsightId: "adaptive.skipped_workout_day_pattern",
          previousTime: "20:30",
          adjustedTime: "19:30",
        },
      ]),
    );
  });

  it("does not move a workout before the known morning schedule boundary", () => {
    const adaptiveInput = input([
      insight("adaptive.skipped_workout_day_pattern", "Move the workout earlier."),
    ]);
    adaptiveInput.plan.dailyPlan.schedule.workout.time = "06:45";
    const result = success(applyAdaptiveAdjustments(adaptiveInput));

    expect(result.adjustments.some(({ type }) => type === "moved-workout")).toBe(false);
    expect(result.plan.dailyPlan.schedule.workout.time).toBe("06:45");
    expect(result.adjustments.some(({ type }) => type === "shorter-workout")).toBe(true);
  });

  it("does not move a workout into a documented schedule conflict", () => {
    const adaptiveInput = input([
      insight("adaptive.skipped_workout_day_pattern", "Move the workout earlier."),
    ]);
    adaptiveInput.plan.dailyPlan.schedule.workout.time = "13:00";
    const result = success(applyAdaptiveAdjustments(adaptiveInput));

    expect(result.adjustments.some(({ type }) => type === "moved-workout")).toBe(false);
    expect(result.plan.dailyPlan.schedule.workout.time).toBe("13:00");
  });

  it("moves the water reminder exactly 30 minutes earlier without changing its target", () => {
    const adaptiveInput = input([
      insight("adaptive.low_hydration_pattern"),
    ]);
    const originalTarget = adaptiveInput.plan.dailyPlan.targets.waterMl;
    const result = success(applyAdaptiveAdjustments(adaptiveInput));

    expect(result.plan.dailyPlan.schedule.waterReminder.time).toBe("12:30");
    expect(result.plan.dailyPlan.targets.waterMl).toBe(originalTarget);
    expect(result.adjustments).toEqual([
      {
        type: "earlier-water-reminder",
        reasonInsightId: "adaptive.low_hydration_pattern",
        previousTime: "13:00",
        adjustedTime: "12:30",
      },
    ]);
  });

  it("leaves a water reminder unchanged inside the wake boundary", () => {
    const adaptiveInput = input([
      insight("adaptive.low_hydration_pattern"),
    ]);
    adaptiveInput.plan.dailyPlan.schedule.waterReminder.time = "06:15";

    expect(applyAdaptiveAdjustments(adaptiveInput)).toEqual({
      status: "not-applicable",
      reason: "no-supported-adjustment",
    });
  });

  it.each(["2026-07-25", "2026-07-26"])(
    "replaces dinner with the approved flexible representation on weekend date %s",
    (date) => {
      const retainedDecision = decision([
        insight("adaptive.weekend_dessert_pattern"),
      ]);
      const result = success(
        applyAdaptiveAdjustments({
          plan: plan(retainedDecision, context({ today: date }), date),
          decision: retainedDecision,
        }),
      );

      expect(result.plan.mealPlan.dinner).toEqual({
        kind: "planned-flexible-meal-without-compensation",
        slot: "dinner",
        reasonInsightId: "adaptive.weekend_dessert_pattern",
      });
      expect(result.adjustments).toEqual([
        {
          type: "weekend-treat",
          reasonInsightId: "adaptive.weekend_dessert_pattern",
          slot: "dinner",
          representation: "planned-flexible-meal-without-compensation",
        },
      ]);
    },
  );

  it("does not apply a weekend treat on a weekday", () => {
    const retainedDecision = decision([
      insight("adaptive.weekend_dessert_pattern"),
    ]);

    expect(
      applyAdaptiveAdjustments({
        plan: plan(retainedDecision, context({ today: "2026-07-27" })),
        decision: retainedDecision,
      }),
    ).toEqual({
      status: "not-applicable",
      reason: "no-supported-adjustment",
    });
  });

  it("applies simultaneous adjustments in the approved priority order", () => {
    const retained = [
      insight("adaptive.weekend_dessert_pattern"),
      insight("adaptive.low_hydration_pattern"),
      insight("adaptive.skipped_workout_day_pattern", "Move the workout earlier."),
      insight("adaptive.late_night_hunger_pattern"),
    ];
    const result = success(applyAdaptiveAdjustments(input(retained)));

    expect(result.adjustments.map(({ type }) => type)).toEqual([
      "bigger-dinner",
      "shorter-workout",
      "moved-workout",
      "earlier-water-reminder",
      "weekend-treat",
    ]);
  });

  it("preserves Migraine eligibility when applying a bigger dinner", () => {
    const retainedDecision = decision([
      insight("migraine.active_symptom_care"),
      insight("adaptive.late_night_hunger_pattern"),
    ]);
    const adaptivePlan = plan(retainedDecision);
    const lowerMigraineDinner = MEAL_TEMPLATES.find(
      ({ id }) => id === "chicken-soup-sayur",
    )!;
    adaptivePlan.mealPlan.dinner = {
      slot: "dinner",
      template: lowerMigraineDinner,
      reason: "Existing approved Migraine-safe dinner.",
    };
    const result = success(
      applyAdaptiveAdjustments({
        plan: adaptivePlan,
        decision: retainedDecision,
      }),
    );
    const dinner = result.plan.mealPlan.dinner;

    expect("kind" in dinner).toBe(false);
    if (!("kind" in dinner)) {
      expect(dinner.template.tags).toContain("migraine-safe");
      expect(dinner.reason).toMatch(/^Migraine-safe choice/);
    }
  });

  it("keeps Thyroid neutral", () => {
    const adaptive = insight("adaptive.late_night_hunger_pattern");
    const withoutThyroidDecision = decision([adaptive]);
    const withThyroidDecision = decision([
      insight("thyroid.deficit_too_aggressive"),
      adaptive,
    ]);
    const sharedPlan = plan(withoutThyroidDecision);
    const withoutThyroid = applyAdaptiveAdjustments({
      plan: sharedPlan,
      decision: withoutThyroidDecision,
    });
    const withThyroid = applyAdaptiveAdjustments({
      plan: sharedPlan,
      decision: withThyroidDecision,
    });

    expect(withThyroid).toEqual(withoutThyroid);
    expect(JSON.stringify(withThyroid)).not.toMatch(
      /thyroid|supplement|medication|medical/i,
    );
  });

  it("returns not-applicable without a retained adaptive insight", () => {
    expect(
      applyAdaptiveAdjustments(input([insight("behavior.consistency_reinforcement")])),
    ).toEqual({
      status: "not-applicable",
      reason: "no-retained-adaptive-insight",
    });
  });

  it("validates dates, clocks, and missing plan components", () => {
    const retainedDecision = decision([insight("adaptive.low_hydration_pattern")]);
    const malformed = plan(retainedDecision);
    malformed.date = "2026-02-30";
    malformed.dailyPlan.schedule.workout.time = "25:00";
    malformed.dailyPlan.schedule.waterReminder.time = "noon";
    delete (malformed.mealPlan as Partial<typeof malformed.mealPlan>).snack;
    const result = applyAdaptiveAdjustments({
      plan: malformed,
      decision: retainedDecision,
    });

    expect(result.status).toBe("invalid-input");
    if (result.status === "invalid-input") {
      expect(result.errors.map(({ code }) => code)).toEqual([
        "invalid-date",
        "invalid-clock",
        "invalid-clock",
        "missing-plan-component",
      ]);
    }
  });

  it("is deterministic and does not mutate input plans, decisions, or templates", () => {
    const adaptiveInput = input([
      insight("adaptive.late_night_hunger_pattern"),
      insight("adaptive.low_hydration_pattern"),
    ]);
    const inputSnapshot = JSON.parse(JSON.stringify(adaptiveInput));
    const templatesSnapshot = JSON.parse(JSON.stringify(MEAL_TEMPLATES));

    const first = applyAdaptiveAdjustments(adaptiveInput);
    const second = applyAdaptiveAdjustments(adaptiveInput);

    expect(second).toEqual(first);
    expect(adaptiveInput).toEqual(inputSnapshot);
    expect(MEAL_TEMPLATES).toEqual(templatesSnapshot);
  });

  it("emits no compensatory restriction or invented food, nutrition, or medical content", () => {
    const result = applyAdaptiveAdjustments(
      input([
        insight("adaptive.weekend_dessert_pattern"),
        insight("adaptive.late_night_hunger_pattern"),
      ]),
    );
    const serialized = JSON.stringify(result);

    expect(serialized).not.toMatch(
      /skip|save calories|compensate afterward|diagnos|treats disease|supplement|medication/i,
    );
  });
});
