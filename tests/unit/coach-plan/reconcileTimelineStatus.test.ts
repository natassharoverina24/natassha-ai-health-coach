import {
  reconcileTimelineStatus,
  type TimelineReconciliationEvidence,
} from "@/lib/coach-plan/reconcileTimelineStatus";
import { buildMealGuidance } from "@/lib/coach-plan/buildMealGuidance";
import type { TodayCoachTimelineStatus } from "@/lib/coach-plan/types";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import {
  generateDailyPlan,
  generateMealPlan,
  type MealSlot,
  type PlannerUserContext,
} from "@/lib/planner";

const decision: CoachDecision = {
  insights: [],
  suppressedEngineNames: [],
  generatedAt: "2026-07-29T08:00:00.000Z",
};

const context: PlannerUserContext = {
  today: "2026-07-29",
  currentHour: 8,
  currentMinute: 0,
  leaveHomeTime: "06:30",
  arriveHomeTime: "19:00",
  lunchProvidedByOffice: false,
  calorieGoal: 1400,
  proteinGoalG: 110,
  waterGoalMl: 2000,
  workoutGoalMinPerDay: 30,
  stepsGoal: 8000,
  sleepGoalHours: 7,
};

const dailyPlan = generateDailyPlan(decision, context);
const rawMeals = generateMealPlan(decision, context);
const meals = buildMealGuidance({
  decision,
  context,
  dailyPlan,
  mealPlan: rawMeals,
  mealLogs: [],
  officeLunchPlan: null,
});

const emptyEvidence: TimelineReconciliationEvidence = {
  mealLogs: [],
  waterLogs: [],
  workoutLogs: [],
  manualCompletions: [],
};

function reconcile(
  evidence: TimelineReconciliationEvidence = emptyEvidence,
  date = context.today,
  currentDate = context.today,
) {
  return reconcileTimelineStatus({
    date,
    currentDate,
    dailyPlan,
    meals,
    evidence,
  });
}

describe("reconcileTimelineStatus", () => {
  it("uses pending as the default status for the current day", () => {
    const result = reconcile();

    expect(result).toHaveLength(6);
    expect(result.every((item) => item.status === "pending")).toBe(true);
    expect(result.every((item) => item.alternative === null)).toBe(true);
    expect(result.every((item) => item.impact.length > 0)).toBe(true);
  });

  it("marks hydration completed from a water log", () => {
    const result = reconcile({
      ...emptyEvidence,
      waterLogs: [{ id: "water-1" }],
    });

    expect(
      result.find((item) => item.kind === "waterReminder"),
    ).toEqual(
      expect.objectContaining({
        status: "completed",
        completionSource: "water-log",
      }),
    );
  });

  it.each(["breakfast", "lunch", "snack", "dinner"] as const)(
    "marks %s completed from the matching meal log",
    (slot: MealSlot) => {
      const result = reconcile({
        ...emptyEvidence,
        mealLogs: [{ id: `meal-${slot}`, type: slot }],
      });

      expect(result.find((item) => item.kind === slot)?.status).toBe(
        "completed",
      );
      expect(
        result.find((item) => item.kind !== slot && item.kind === "breakfast")
          ?.status,
      ).not.toBe("completed");
    },
  );

  it("marks workout completed from a workout log", () => {
    const result = reconcile({
      ...emptyEvidence,
      workoutLogs: [{ id: "workout-1" }],
    });

    expect(result.find((item) => item.kind === "workout")?.status).toBe(
      "completed",
    );
  });

  it("marks an uncompleted past-day item missed with non-punitive wording", () => {
    const result = reconcile(emptyEvidence, "2026-07-28", "2026-07-29");
    const statusTypeCheck: TodayCoachTimelineStatus = result[0].status;

    expect(statusTypeCheck).toBe("missed");
    expect(result[0].statusMessage).toMatch(/next plan remains available/i);
    expect(result[0].statusMessage).not.toMatch(
      /failed|bad|blame|should have|punish/i,
    );
  });

  it("keeps status pending when an optional source is unavailable", () => {
    const result = reconcile(
      { ...emptyEvidence, waterLogs: null },
      "2026-07-28",
      "2026-07-29",
    );

    expect(
      result.find((item) => item.kind === "waterReminder")?.status,
    ).toBe("pending");
    expect(result).toHaveLength(6);
  });

  it("keeps planner and log source IDs traceable", () => {
    const result = reconcile({
      ...emptyEvidence,
      mealLogs: [{ id: "breakfast-log", type: "breakfast" }],
    });
    const breakfast = result.find((item) => item.kind === "breakfast");

    expect(breakfast?.sourceIds).toEqual(
      expect.arrayContaining([
        "planner.meal.breakfast",
        "repository.meal-log",
        "meal-log:breakfast-log",
      ]),
    );
  });
});
