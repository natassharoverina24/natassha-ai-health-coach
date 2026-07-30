import {
  readTodayCoachPlanCache,
  writeTodayCoachPlanCache,
} from "@/lib/coach-plan/cache";
import type { TodayCoachPlan } from "@/lib/coach-plan/types";

function planFixture(): TodayCoachPlan {
  return {
    generatedAt: "2026-07-29T08:00:00.000Z",
    date: "2026-07-29",
    status: "ready",
    greeting: { value: "Ready", sourceIds: ["greeting"] },
    briefing: {
      retainedInsights: [
        {
          id: "why.personal",
          engine: "why",
          priority: "low",
          urgency: "none",
          tone: "encouraging",
          summary: "Private free text",
          reason: "Private free text",
          recommendedAction: "Private free text",
        },
      ],
      encouragement: {
        value: "Private user motivation",
        sourceIds: ["why.personal"],
      },
      sourceIds: ["why.personal"],
    },
    focus: null,
    biggestRisk: null,
    todaysWin: null,
    timeline: [],
    meals: {} as TodayCoachPlan["meals"],
    metrics: {
      value: {
        calories: 1400,
        proteinG: 110,
        waterMl: 2000,
        workoutMin: 30,
        steps: 8000,
        sleepHours: 7,
      },
      sourceIds: ["targets"],
    },
    officeLunch: null,
    emergencyAdjustment: null,
    adaptiveAdjustments: {
      value: { status: "not-applicable", reason: "no-retained-adaptive-insight" },
      sourceIds: ["adaptive"],
    },
    weeklyContext: null,
    dataAvailability: {
      decision: "available",
      dailyPlan: "available",
      mealPlan: "available",
      officeLunch: "unavailable",
      emergencyAdjustment: "unavailable",
      adaptiveAdjustments: "not-applicable",
      weeklyContext: "unavailable",
      timelineStatus: {
        mealLogs: "empty",
        waterLogs: "empty",
        workoutLogs: "empty",
        manualCompletions: "empty",
      },
      sources: {
        profile: { status: "available" },
        settings: { status: "available" },
        currentDateTime: { status: "available" },
        weights: { status: "empty" },
        meals: { status: "empty" },
        water: { status: "empty" },
        workouts: { status: "empty" },
        sleep: { status: "empty" },
        cycles: { status: "empty" },
        motivations: { status: "empty" },
        timelineCompletions: { status: "empty" },
      },
      cache: { status: "empty" },
    },
    warnings: [],
  };
}

describe("TodayCoachPlan browser cache", () => {
  beforeEach(() => localStorage.clear());

  it("stores a structured envelope and removes user free text", () => {
    writeTodayCoachPlanCache(
      "user-1",
      planFixture(),
      "2026-07-29T09:00:00.000Z",
    );
    const raw = localStorage.getItem("today-coach-plan:last-known");

    expect(raw).toContain('"userId":"user-1"');
    expect(raw).toContain('"savedAt":"2026-07-29T09:00:00.000Z"');
    expect(raw).not.toMatch(/Private free text|Private user motivation/);
    expect(raw).not.toMatch(/base64|imageUrl|storagePath|apiKey/i);
  });

  it("returns only the matching user's same-day plan as stale", () => {
    writeTodayCoachPlanCache(
      "user-1",
      planFixture(),
      "2026-07-29T09:00:00.000Z",
    );

    const cached = readTodayCoachPlanCache("user-1", "2026-07-29");
    expect(cached?.status).toBe("partial");
    expect(cached?.dataAvailability.cache).toEqual({
      status: "stale",
      updatedAt: "2026-07-29T09:00:00.000Z",
    });
    expect(cached?.warnings).toContainEqual(
      expect.objectContaining({ code: "cached-plan-stale" }),
    );
    expect(readTodayCoachPlanCache("other-user", "2026-07-29")).toBeNull();
    expect(readTodayCoachPlanCache("user-1", "2026-07-30")).toBeNull();
  });

  it("ignores malformed browser cache data", () => {
    localStorage.setItem("today-coach-plan:last-known", "{private-stack");
    expect(readTodayCoachPlanCache("user-1", "2026-07-29")).toBeNull();
  });
});
