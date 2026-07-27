import { generateDailyPlan } from "@/lib/planner/dailyPlanner";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { EngineInsight } from "@/lib/engines/types";
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

function makeDecision(insights: EngineInsight[], generatedAt = "2026-07-25T06:00:00.000Z"): CoachDecision {
  return { insights, suppressedEngineNames: [], generatedAt };
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

describe("generateDailyPlan — targets", () => {
  it("surfaces all six targets from the context, unchanged", () => {
    const plan = generateDailyPlan(makeDecision([]), makeContext());
    expect(plan.targets).toEqual({
      calories: 1400,
      proteinG: 110,
      waterMl: 2000,
      workoutMin: 30,
      steps: 8000,
      sleepHours: 7,
    });
  });

  it("reflects custom goals when provided", () => {
    const plan = generateDailyPlan(
      makeDecision([]),
      makeContext({ calorieGoal: 1600, proteinGoalG: 130, waterGoalMl: 2500 }),
    );
    expect(plan.targets.calories).toBe(1600);
    expect(plan.targets.proteinG).toBe(130);
    expect(plan.targets.waterMl).toBe(2500);
  });
});

describe("generateDailyPlan — schedule", () => {
  it("places all six schedule slots around the confirmed commute window", () => {
    const plan = generateDailyPlan(makeDecision([]), makeContext());
    expect(plan.schedule.breakfast.time).toBe("06:00");
    expect(plan.schedule.lunch.time).toBe("12:00");
    expect(plan.schedule.snack.time).toBe("15:00");
    expect(plan.schedule.dinner.time).toBe("20:00");
    expect(plan.schedule.workout.time).toBe("20:30");
    expect(plan.schedule.waterReminder.time).toBe("13:00");
  });

  it("adapts to a different commute window", () => {
    const plan = generateDailyPlan(
      makeDecision([]),
      makeContext({ leaveHomeTime: "07:00", arriveHomeTime: "18:00" }),
    );
    expect(plan.schedule.breakfast.time).toBe("06:30");
    expect(plan.schedule.dinner.time).toBe("19:00");
    expect(plan.schedule.workout.time).toBe("19:30");
  });
});

describe("generateDailyPlan — summary, normal day", () => {
  it("extracts top priority, biggest risk, and action from the highest-ranked insight", () => {
    const plan = generateDailyPlan(
      makeDecision([
        insight({ id: "nutrition.protein_first", priority: "high", summary: "Protein low", recommendedAction: "Eat chicken" }),
        insight({ id: "exercise.minimum_action", priority: "medium", summary: "No workout", recommendedAction: "Walk 30 min" }),
      ]),
      makeContext(),
    );
    expect(plan.summary.topPriority?.id).toBe("nutrition.protein_first");
    expect(plan.summary.biggestRisk?.id).toBe("nutrition.protein_first");
    expect(plan.summary.biggestRisk?.summary).toBe("Protein low");
    expect(plan.summary.biggestRisk?.recommendedAction).toBe("Eat chicken");
  });

  it("sets todaysWin to null when no insight is celebratory", () => {
    const plan = generateDailyPlan(
      makeDecision([insight({ id: "a", tone: "neutral" })]),
      makeContext(),
    );
    expect(plan.summary.todaysWin).toBeNull();
  });
});

describe("generateDailyPlan — celebration day", () => {
  it("sets biggestRisk to null when the top insight is celebratory", () => {
    const plan = generateDailyPlan(
      makeDecision([insight({ id: "streak", tone: "celebratory", summary: "3-day streak!" })]),
      makeContext(),
    );
    expect(plan.summary.topPriority?.id).toBe("streak");
    expect(plan.summary.biggestRisk).toBeNull();
    expect(plan.summary.todaysWin?.id).toBe("streak");
  });
});

describe("generateDailyPlan — WHY Engine fired", () => {
  it("includes the motivation text as encouragement", () => {
    const plan = generateDailyPlan(
      makeDecision([
        insight({
          id: "why.surface_motivation",
          engine: "why",
          tone: "encouraging",
          summary: "A motivation is available.",
          recommendedAction: 'Reference this motivation: "Wedding"',
          data: { motivationId: "m1", motivationText: "Wedding" },
        }),
      ]),
      makeContext(),
    );
    expect(plan.summary.encouragement).toBe("Wedding");
  });
});

describe("generateDailyPlan — missing WHY insight", () => {
  it("sets encouragement to null when the WHY Engine is silent", () => {
    const plan = generateDailyPlan(
      makeDecision([insight({ id: "behavior.consistency_reinforcement", tone: "celebratory" })]),
      makeContext(),
    );
    expect(plan.summary.encouragement).toBeNull();
  });
});

describe("generateDailyPlan — no insights at all", () => {
  it("returns all-null summary fields when the decision has no insights", () => {
    const plan = generateDailyPlan(makeDecision([]), makeContext());
    expect(plan.summary.topPriority).toBeNull();
    expect(plan.summary.biggestRisk).toBeNull();
    expect(plan.summary.todaysWin).toBeNull();
    expect(plan.summary.encouragement).toBeNull();
  });

  it("still produces valid targets and schedule even with no insights", () => {
    const plan = generateDailyPlan(makeDecision([]), makeContext());
    expect(plan.targets.calories).toBe(1400);
    expect(plan.schedule.breakfast.time).toBe("06:00");
  });
});

describe("generateDailyPlan — generatedAt", () => {
  it("passes through the CoachDecision's generatedAt timestamp", () => {
    const plan = generateDailyPlan(
      makeDecision([], "2026-07-25T08:00:00.000Z"),
      makeContext(),
    );
    expect(plan.generatedAt).toBe("2026-07-25T08:00:00.000Z");
  });
});

describe("generateDailyPlan — default goals", () => {
  it("produces the correct default targets when no custom goals are set", () => {
    const plan = generateDailyPlan(makeDecision([]), makeContext());
    expect(plan.targets).toEqual({
      calories: 1400,
      proteinG: 110,
      waterMl: 2000,
      workoutMin: 30,
      steps: 8000,
      sleepHours: 7,
    });
  });
});
