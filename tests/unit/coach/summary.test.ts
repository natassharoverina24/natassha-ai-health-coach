import { computeCoachScoreSummary, computeWeeklyReview } from "@/lib/coach/summary";
import type { DailyGoals, DailyLogInputs } from "@/lib/coach/types";

const GOALS: DailyGoals = {
  calorieGoal: 1400,
  proteinGoalG: 110,
  waterGoalMl: 2000,
  workoutGoalMinPerDay: 30,
  sleepGoalHours: 7,
};

function makeInput(overrides: Partial<DailyLogInputs> = {}): DailyLogInputs {
  return {
    date: "2026-07-25",
    caloriesConsumed: 0,
    proteinConsumedG: 0,
    waterMl: 0,
    workoutMinutes: 0,
    sleepHours: null,
    mealTypesLogged: [],
    ...overrides,
  };
}

describe("computeWeeklyReview", () => {
  it("computes weight and waist net change across the given entries", () => {
    const review = computeWeeklyReview(
      [makeInput()],
      GOALS,
      [
        { date: "2026-07-19", weightKg: 70 },
        { date: "2026-07-25", weightKg: 68.5 },
      ],
      [
        { date: "2026-07-19", waistCm: 80 },
        { date: "2026-07-25", waistCm: 78 },
      ],
    );
    expect(review.weightChangeKg).toBeCloseTo(-1.5);
    expect(review.waistChangeCm).toBeCloseTo(-2);
  });

  it("returns null changes when fewer than two entries exist", () => {
    const review = computeWeeklyReview([makeInput()], GOALS, [{ date: "2026-07-25", weightKg: 70 }], []);
    expect(review.weightChangeKg).toBeNull();
    expect(review.waistChangeCm).toBeNull();
  });

  it("includes weekly adherence computed from the daily inputs", () => {
    const review = computeWeeklyReview(
      [makeInput({ proteinConsumedG: 110 }), makeInput({ proteinConsumedG: 0 })],
      GOALS,
      [],
      [],
    );
    expect(review.adherence.protein).toBe(50);
  });
});

describe("computeCoachScoreSummary", () => {
  it("uses the last day's overall score as the current score", () => {
    const summary = computeCoachScoreSummary(
      [makeInput({ date: "2026-07-24", proteinConsumedG: 0 }), makeInput({ date: "2026-07-25", proteinConsumedG: 110 })],
      [],
      GOALS,
    );
    // Only the protein dimension is non-zero on 07-25: overall = 100/6 rounded
    expect(summary.currentScore).toBe(Math.round(100 / 6));
  });

  it("returns null current score when the current week has no days", () => {
    const summary = computeCoachScoreSummary([], [], GOALS);
    expect(summary.currentScore).toBeNull();
    expect(summary.weeklyAverage).toBe(0);
  });

  it("computes trend by comparing this week's average to the previous week's", () => {
    const goodWeek = [makeInput({ proteinConsumedG: 110, waterMl: 2000, workoutMinutes: 30, sleepHours: 7, caloriesConsumed: 1400, mealTypesLogged: ["breakfast", "lunch", "dinner"] })];
    const badWeek = [makeInput({})];
    const summary = computeCoachScoreSummary(goodWeek, badWeek, GOALS);
    expect(summary.trend).toBe("up");
    expect(summary.weeklyAverage).toBeGreaterThan(summary.previousWeeklyAverage);
  });

  it("exposes the per-day scores for charting", () => {
    const summary = computeCoachScoreSummary(
      [makeInput({ date: "2026-07-24" }), makeInput({ date: "2026-07-25" })],
      [],
      GOALS,
    );
    expect(summary.dailyScores.map((d) => d.date)).toEqual(["2026-07-24", "2026-07-25"]);
  });
});
