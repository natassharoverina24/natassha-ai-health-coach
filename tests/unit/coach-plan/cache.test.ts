import {
  invalidateTodayCoachPlanCache,
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
      coachScore: {
        value: null,
        unit: "/100",
        status: "empty",
        sourceIds: ["coach.daily-score"],
      },
      calories: {
        value: 0,
        unit: "kcal",
        status: "empty",
        target: 1400,
        remaining: 1400,
        progressPercent: 0,
        sourceIds: ["meals"],
      },
      protein: {
        value: 0,
        unit: "g",
        status: "empty",
        target: 110,
        remaining: 110,
        progressPercent: 0,
        sourceIds: ["meals"],
      },
      water: {
        value: 0,
        unit: "ml",
        status: "empty",
        target: 2000,
        remaining: 2000,
        progressPercent: 0,
        sourceIds: ["water"],
      },
      sleep: {
        value: null,
        unit: "h",
        status: "empty",
        target: 7,
        remaining: null,
        progressPercent: null,
        sourceIds: ["sleep"],
      },
      workout: {
        value: 0,
        unit: "min",
        status: "empty",
        target: 30,
        remaining: 30,
        progressPercent: 0,
        sourceIds: ["workouts"],
      },
      body: {
        weightKg: { value: null, unit: "kg", status: "empty", sourceIds: ["weights"] },
        waistCm: { value: null, unit: "cm", status: "empty", sourceIds: ["waists"] },
        bmrKcal: { value: null, unit: "kcal", status: "empty", sourceIds: ["profile"] },
        tdeeKcal: { value: null, unit: "kcal", status: "empty", sourceIds: ["profile"] },
        deficitKcal: { value: null, unit: "kcal", status: "empty", sourceIds: ["profile"] },
        trend: null,
      },
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
        waists: { status: "empty" },
        meals: { status: "empty" },
        water: { status: "empty" },
        workouts: { status: "empty" },
        sleep: { status: "empty" },
        cycles: { status: "empty" },
        motivations: { status: "empty" },
        timelineCompletions: { status: "empty" },
        activeDisruption: { status: "empty" },
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

  it("clears the cached plan and announces a refresh after meal changes", () => {
    localStorage.setItem("today-coach-plan:last-known", "stale");
    const listener = jest.fn();
    window.addEventListener("today-coach-plan:invalidated", listener);

    invalidateTodayCoachPlanCache();

    expect(localStorage.getItem("today-coach-plan:last-known")).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("today-coach-plan:invalidated", listener);
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
