import {
  computeDailyCoachScore,
  computeDailyCoachScores,
  computeDailyDimensionScores,
  computeOverallScore,
  computeTrend,
  computeWeeklyAdherence,
  computeWeeklyAverageScore,
} from "@/lib/coach/scoring";
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

describe("computeDailyDimensionScores — calories (closeness-based)", () => {
  it("scores 100 when calories exactly match the goal", () => {
    const scores = computeDailyDimensionScores(makeInput({ caloriesConsumed: 1400 }), GOALS);
    expect(scores.calories).toBe(100);
  });

  it("penalizes overshooting the calorie goal", () => {
    const scores = computeDailyDimensionScores(makeInput({ caloriesConsumed: 1680 }), GOALS); // +20%
    expect(scores.calories).toBe(80);
  });

  it("penalizes undershooting the calorie goal", () => {
    const scores = computeDailyDimensionScores(makeInput({ caloriesConsumed: 1120 }), GOALS); // -20%
    expect(scores.calories).toBe(80);
  });

  it("floors at zero for wildly off-target calories", () => {
    const scores = computeDailyDimensionScores(makeInput({ caloriesConsumed: 5000 }), GOALS);
    expect(scores.calories).toBe(0);
  });
});

describe("computeDailyDimensionScores — protein/water/workout (at-least-goal)", () => {
  it("scores 100 for meeting the protein goal exactly", () => {
    const scores = computeDailyDimensionScores(makeInput({ proteinConsumedG: 110 }), GOALS);
    expect(scores.protein).toBe(100);
  });

  it("caps at 100 for exceeding the protein goal — surplus is never penalized", () => {
    const scores = computeDailyDimensionScores(makeInput({ proteinConsumedG: 220 }), GOALS);
    expect(scores.protein).toBe(100);
  });

  it("scores proportionally below the goal", () => {
    const scores = computeDailyDimensionScores(makeInput({ proteinConsumedG: 55 }), GOALS);
    expect(scores.protein).toBe(50);
  });

  it("scores water and workout the same way", () => {
    const scores = computeDailyDimensionScores(
      makeInput({ waterMl: 1000, workoutMinutes: 15 }),
      GOALS,
    );
    expect(scores.water).toBe(50);
    expect(scores.workout).toBe(50);
  });
});

describe("computeDailyDimensionScores — sleep", () => {
  it("scores zero when no sleep entry was logged (null, distinct from zero hours)", () => {
    const scores = computeDailyDimensionScores(makeInput({ sleepHours: null }), GOALS);
    expect(scores.sleep).toBe(0);
  });

  it("scores proportionally to the sleep goal, capped at 100", () => {
    expect(computeDailyDimensionScores(makeInput({ sleepHours: 3.5 }), GOALS).sleep).toBe(50);
    expect(computeDailyDimensionScores(makeInput({ sleepHours: 9 }), GOALS).sleep).toBe(100);
  });
});

describe("computeDailyDimensionScores — meal logging", () => {
  it("scores 100 when all three core meals are logged", () => {
    const scores = computeDailyDimensionScores(
      makeInput({ mealTypesLogged: ["breakfast", "lunch", "dinner"] }),
      GOALS,
    );
    expect(scores.mealLogging).toBe(100);
  });

  it("scores proportionally for partial logging", () => {
    const scores = computeDailyDimensionScores(makeInput({ mealTypesLogged: ["lunch"] }), GOALS);
    expect(scores.mealLogging).toBeCloseTo(33.33, 1);
  });

  it("does not count snacks toward the core meal-logging score", () => {
    const scores = computeDailyDimensionScores(makeInput({ mealTypesLogged: ["snack"] }), GOALS);
    expect(scores.mealLogging).toBe(0);
  });

  it("scores zero when nothing is logged", () => {
    const scores = computeDailyDimensionScores(makeInput(), GOALS);
    expect(scores.mealLogging).toBe(0);
  });
});

describe("computeOverallScore", () => {
  it("averages the six dimension scores", () => {
    const overall = computeOverallScore({
      calories: 100,
      protein: 100,
      water: 100,
      workout: 100,
      sleep: 100,
      mealLogging: 100,
    });
    expect(overall).toBe(100);
  });

  it("rounds to the nearest whole number", () => {
    const overall = computeOverallScore({
      calories: 100,
      protein: 0,
      water: 0,
      workout: 0,
      sleep: 0,
      mealLogging: 0,
    });
    expect(overall).toBe(17); // 100/6 = 16.67 -> rounds to 17
  });
});

describe("computeDailyCoachScore / computeDailyCoachScores", () => {
  it("attaches the date and computes overall from the dimension scores", () => {
    const score = computeDailyCoachScore(
      makeInput({ date: "2026-07-20", caloriesConsumed: 1400, proteinConsumedG: 110, waterMl: 2000, workoutMinutes: 30, sleepHours: 7, mealTypesLogged: ["breakfast", "lunch", "dinner"] }),
      GOALS,
    );
    expect(score.date).toBe("2026-07-20");
    expect(score.overall).toBe(100);
  });

  it("maps a list of inputs to a list of scores", () => {
    const scores = computeDailyCoachScores([makeInput({ date: "a" }), makeInput({ date: "b" })], GOALS);
    expect(scores.map((s) => s.date)).toEqual(["a", "b"]);
  });
});

describe("computeWeeklyAdherence", () => {
  it("averages each dimension across the given days", () => {
    const scores = [
      computeDailyCoachScore(makeInput({ proteinConsumedG: 110 }), GOALS),
      computeDailyCoachScore(makeInput({ proteinConsumedG: 0 }), GOALS),
    ];
    const adherence = computeWeeklyAdherence(scores);
    expect(adherence.protein).toBe(50);
  });

  it("returns all-zero adherence for an empty week", () => {
    expect(computeWeeklyAdherence([])).toEqual({
      calories: 0,
      protein: 0,
      water: 0,
      workout: 0,
      sleep: 0,
      mealLogging: 0,
    });
  });
});

describe("computeWeeklyAverageScore", () => {
  it("averages the overall score across days", () => {
    const scores = [
      { date: "a", dimensions: {} as never, overall: 80 },
      { date: "b", dimensions: {} as never, overall: 60 },
    ];
    expect(computeWeeklyAverageScore(scores)).toBe(70);
  });

  it("returns 0 for an empty list", () => {
    expect(computeWeeklyAverageScore([])).toBe(0);
  });
});

describe("computeTrend", () => {
  it("reports up when the current score is higher", () => {
    expect(computeTrend(80, 60)).toBe("up");
  });

  it("reports down when the current score is lower", () => {
    expect(computeTrend(50, 70)).toBe("down");
  });

  it("reports flat when scores are equal", () => {
    expect(computeTrend(50, 50)).toBe("flat");
  });
});
