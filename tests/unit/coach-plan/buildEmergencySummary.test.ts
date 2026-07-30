import { buildEmergencySummary } from "@/lib/coach-plan/buildEmergencySummary";
import type { TodayCoachTimelineItem } from "@/lib/coach-plan/types";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { PlannerUserContext } from "@/lib/planner";
import type {
  ActiveDisruption,
  EmergencyDisruptionType,
} from "@/types/firestore";

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

const noInsights: CoachDecision = {
  insights: [],
  suppressedEngineNames: [],
  generatedAt: "2026-07-29T08:00:00.000Z",
};

function timelineItem(
  kind: TodayCoachTimelineItem["kind"],
  time: string,
): TodayCoachTimelineItem {
  return {
    id: `2026-07-29:${kind}`,
    date: "2026-07-29",
    kind,
    time,
    label: kind,
    action: `Keep planned ${kind}`,
    reason: "Existing planner reason.",
    alternative: null,
    impact: [
      {
        metric: kind === "workout" ? "workoutMin" : "calories",
        plannedValue: kind === "workout" ? 30 : 300,
        dailyTarget: kind === "workout" ? 30 : 1400,
        unit: kind === "workout" ? "min" : "kcal",
        sourceIds: ["planner.daily-plan"],
      },
    ],
    status: "pending",
    statusMessage: "Still open for today.",
    completionSource: kind === "workout" ? "workout-log" : "meal-log",
    manualCompletionAllowed: false,
    sourceIds: ["planner.daily-plan"],
  };
}

const timeline = [
  timelineItem("breakfast", "07:00"),
  timelineItem("lunch", "12:00"),
  timelineItem("snack", "16:00"),
  timelineItem("dinner", "19:00"),
  timelineItem("workout", "18:00"),
  timelineItem("waterReminder", "09:00"),
];

function disruption(
  type: EmergencyDisruptionType,
  overrides: Partial<ActiveDisruption> = {},
): ActiveDisruption {
  return {
    id: `user-1__2026-07-29`,
    createdAt: "2026-07-29T08:00:00.000Z",
    updatedAt: "2026-07-29T08:00:00.000Z",
    userId: "user-1",
    date: "2026-07-29",
    type,
    startedAt: "2026-07-29T08:00:00.000Z",
    note: null,
    status: "active",
    clearedAt: null,
    expectedEndAt: null,
    affectedSlot: null,
    affectedMealSlot: null,
    skippedMealSlot: null,
    skippedAt: null,
    ...overrides,
  };
}

const cases: ActiveDisruption[] = [
  disruption("working-late", { expectedEndAt: "21:00" }),
  disruption("migraine"),
  disruption("feeling-unwell"),
  disruption("pms"),
  disruption("travelling", { affectedSlot: "lunch" }),
  disruption("event-or-reception", { affectedMealSlot: "dinner" }),
  disruption("missed-workout"),
  disruption("skipped-meal", {
    skippedMealSlot: "breakfast",
    skippedAt: "08:00",
  }),
];

describe("buildEmergencySummary", () => {
  it.each(cases)("adapts user-declared $type without changing targets", (active) => {
    const result = buildEmergencySummary({
      active,
      decision: noInsights,
      context,
      timeline,
    });

    expect(result.summary.type).toBe(active.type);
    expect(result.summary.changedTimelineItemIds.length).toBeGreaterThan(0);
    expect(result.summary.preservedTargets).toEqual([
      "calories",
      "protein",
      "water",
      "workout",
      "sleep",
    ]);
    expect(result.timeline.filter((item) => item.status === "adjusted").length)
      .toBeGreaterThan(0);
    expect(result.timeline.flatMap((item) => item.impact)).toEqual(
      timeline.flatMap((item) => item.impact),
    );
  });

  it.each(["migraine", "pms"] as const)(
    "keeps user-declared %s wording non-diagnostic without a retained insight",
    (type) => {
      const result = buildEmergencySummary({
        active: disruption(type),
        decision: noInsights,
        context,
        timeline,
      });

      expect(result.summary.message).toBe(
        "We'll adjust the plan gently based on what you selected.",
      );
      expect(result.summary.message).not.toMatch(/detected|diagnos/i);
      expect(result.summary.sourceIds).toContain(
        "active-disruption:user-1__2026-07-29",
      );
    },
  );

  it("uses retained migraine traceability without inventing medical advice", () => {
    const decision: CoachDecision = {
      ...noInsights,
      insights: [
        {
          id: "migraine.long_gap_risk",
          engine: "migraine",
          priority: "critical",
          urgency: "now",
          tone: "neutral",
          summary: "Retained safety insight.",
          reason: "Existing retained reason.",
          recommendedAction: "Keep substantive eating.",
        },
      ],
    };
    const result = buildEmergencySummary({
      active: disruption("migraine"),
      decision,
      context,
      timeline,
    });

    expect(result.summary.sourceIds).toContain("migraine.long_gap_risk");
    expect(JSON.stringify(result)).not.toMatch(
      /medication|diagnosis|supplement|calorie punishment/i,
    );
    expect(result.timeline.find((item) => item.kind === "waterReminder"))
      .toEqual(timeline.find((item) => item.kind === "waterReminder"));
  });

  it("marks missed workout gently without reducing calorie impact", () => {
    const result = buildEmergencySummary({
      active: disruption("missed-workout"),
      decision: noInsights,
      context,
      timeline,
    });

    const workout = result.timeline.find((item) => item.kind === "workout");
    expect(workout).toMatchObject({
      status: "adjusted",
      action: "Keep the workout optional today without penalty",
    });
    expect(workout?.statusMessage).not.toMatch(/failed|punish/i);
    expect(result.timeline.flatMap((item) => item.impact)).toEqual(
      timeline.flatMap((item) => item.impact),
    );
  });
});
