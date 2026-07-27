import {
  computeMilestones,
  computeStreakMilestones,
  computeWeightMilestones,
  computeWorkoutMilestones,
} from "@/lib/coach/milestones";
import type { DailyCoachScore } from "@/lib/coach/types";

function makeDailyScore(date: string, overall: number): DailyCoachScore {
  return {
    date,
    dimensions: { calories: overall, protein: overall, water: overall, workout: overall, sleep: overall, mealLogging: overall },
    overall,
  };
}

describe("computeWeightMilestones", () => {
  it("returns nothing for no weight history", () => {
    expect(computeWeightMilestones({ weights: [], startWeightKg: 71, goalWeightKg: 53 })).toEqual([]);
  });

  it("always includes the first-weigh-in milestone once any entry exists", () => {
    const milestones = computeWeightMilestones({
      weights: [{ date: "2026-07-01", weightKg: 71 }],
      startWeightKg: 71,
      goalWeightKg: 53,
    });
    expect(milestones.some((m) => m.id === "weight-first-entry")).toBe(true);
  });

  it("reports the highest weight-loss threshold crossed, not every one", () => {
    const milestones = computeWeightMilestones({
      weights: [
        { date: "2026-07-01", weightKg: 71 },
        { date: "2026-07-20", weightKg: 65 }, // 6kg lost -> crosses 1,3,5, not 10
      ],
      startWeightKg: 71,
      goalWeightKg: 53,
    });
    const lossMilestones = milestones.filter((m) => m.id.startsWith("weight-lost-"));
    expect(lossMilestones).toHaveLength(1);
    expect(lossMilestones[0].id).toBe("weight-lost-5kg");
  });

  it("flags halfway-to-goal once past the midpoint", () => {
    const milestones = computeWeightMilestones({
      weights: [
        { date: "2026-07-01", weightKg: 71 },
        { date: "2026-07-20", weightKg: 62 }, // 9kg of 18kg total = 50%
      ],
      startWeightKg: 71,
      goalWeightKg: 53,
    });
    expect(milestones.some((m) => m.id === "weight-halfway")).toBe(true);
  });

  it("flags goal-reached once at or below the goal weight", () => {
    const milestones = computeWeightMilestones({
      weights: [{ date: "2026-07-20", weightKg: 52 }],
      startWeightKg: 71,
      goalWeightKg: 53,
    });
    expect(milestones.some((m) => m.id === "weight-goal-reached")).toBe(true);
  });
});

describe("computeStreakMilestones", () => {
  it("returns nothing when there's no data", () => {
    expect(computeStreakMilestones([])).toEqual([]);
  });

  it("returns nothing when the current streak is below the smallest threshold", () => {
    const scores = [makeDailyScore("2026-07-24", 80), makeDailyScore("2026-07-25", 20)];
    expect(computeStreakMilestones(scores)).toEqual([]);
  });

  it("reports the highest streak threshold crossed by consecutive high-scoring days ending today", () => {
    const dates = ["2026-07-19", "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24", "2026-07-25"];
    const scores = dates.map((d) => makeDailyScore(d, 85));
    const milestones = computeStreakMilestones(scores);
    expect(milestones).toHaveLength(1);
    expect(milestones[0].id).toBe("streak-7-days");
  });

  it("stops counting the streak at the first day below threshold, walking back from the most recent day", () => {
    const scores = [
      makeDailyScore("2026-07-20", 85),
      makeDailyScore("2026-07-21", 10), // breaks the streak
      makeDailyScore("2026-07-22", 85),
      makeDailyScore("2026-07-23", 85),
      makeDailyScore("2026-07-24", 85),
    ];
    const milestones = computeStreakMilestones(scores);
    // Active streak is exactly 3 days (07-22, 07-23, 07-24) — crosses the 3-day
    // threshold but not 7, and the broken day (07-21) must not count toward it.
    expect(milestones).toHaveLength(1);
    expect(milestones[0].id).toBe("streak-3-days");
  });
});

describe("computeWorkoutMilestones", () => {
  it("returns nothing for zero workouts", () => {
    expect(computeWorkoutMilestones([])).toEqual([]);
  });

  it("reports the first-workout milestone for exactly one workout", () => {
    const milestones = computeWorkoutMilestones([{ date: "2026-07-25" }]);
    expect(milestones).toHaveLength(1);
    expect(milestones[0].title).toBe("First workout logged");
  });

  it("reports the highest count threshold crossed, not every one", () => {
    const workouts = Array.from({ length: 12 }, (_, i) => ({ date: `2026-07-${String(i + 1).padStart(2, "0")}` }));
    const milestones = computeWorkoutMilestones(workouts);
    expect(milestones).toHaveLength(1);
    expect(milestones[0].id).toBe("workout-count-10");
  });
});

describe("computeMilestones", () => {
  it("combines weight, streak, and workout milestones into one list", () => {
    const milestones = computeMilestones({
      weights: [{ date: "2026-07-01", weightKg: 71 }],
      startWeightKg: 71,
      goalWeightKg: 53,
      workouts: [{ date: "2026-07-25" }],
      dailyScores: [],
    });
    const categories = new Set(milestones.map((m) => m.category));
    expect(categories.has("weight")).toBe(true);
    expect(categories.has("workout")).toBe(true);
  });
});
