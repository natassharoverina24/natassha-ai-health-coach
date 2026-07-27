import { largestGapHours, runNutritionEngine } from "@/lib/engines/nutrition.engine";
import type { DailyGoals, DailyLogInputs } from "@/lib/coach/types";

const GOALS: DailyGoals = {
  calorieGoal: 1400,
  proteinGoalG: 110,
  waterGoalMl: 2000,
  workoutGoalMinPerDay: 30,
  sleepGoalHours: 7,
};

function makeToday(overrides: Partial<DailyLogInputs> = {}): DailyLogInputs {
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

describe("largestGapHours", () => {
  it("returns 0 for fewer than two timestamps", () => {
    expect(largestGapHours([])).toBe(0);
    expect(largestGapHours([{ type: "breakfast", loggedAt: "2026-07-25T08:00:00.000Z" }])).toBe(0);
  });

  it("computes the largest gap between timestamps regardless of input order", () => {
    const gap = largestGapHours([
      { type: "dinner", loggedAt: "2026-07-25T20:00:00.000Z" },
      { type: "breakfast", loggedAt: "2026-07-25T08:00:00.000Z" },
      { type: "lunch", loggedAt: "2026-07-25T13:00:00.000Z" },
    ]);
    expect(gap).toBe(7); // dinner - lunch = 7h, larger than lunch - breakfast = 5h
  });
});

describe("runNutritionEngine — protein first", () => {
  it("flags low protein in the afternoon", () => {
    const insights = runNutritionEngine({
      today: makeToday({ proteinConsumedG: 30 }),
      goals: GOALS,
      todaysMealTimestamps: [],
      lunchProvidedByOffice: false,
      currentHour: 14,
    });
    expect(insights.some((i) => i.id === "nutrition.protein_first")).toBe(true);
  });

  it("does not flag low protein in the morning, before it's a fair assessment", () => {
    const insights = runNutritionEngine({
      today: makeToday({ proteinConsumedG: 0 }),
      goals: GOALS,
      todaysMealTimestamps: [],
      lunchProvidedByOffice: false,
      currentHour: 8,
    });
    expect(insights.some((i) => i.id === "nutrition.protein_first")).toBe(false);
  });

  it("does not flag protein once the goal is met", () => {
    const insights = runNutritionEngine({
      today: makeToday({ proteinConsumedG: 110 }),
      goals: GOALS,
      todaysMealTimestamps: [],
      lunchProvidedByOffice: false,
      currentHour: 20,
    });
    expect(insights.some((i) => i.id === "nutrition.protein_first")).toBe(false);
  });
});

describe("runNutritionEngine — migraine-safe meal timing / structured meals", () => {
  it("flags a meal gap beyond 5 hours", () => {
    const insights = runNutritionEngine({
      today: makeToday({ proteinConsumedG: 110 }),
      goals: GOALS,
      todaysMealTimestamps: [
        { type: "breakfast", loggedAt: "2026-07-25T07:00:00.000Z" },
        { type: "dinner", loggedAt: "2026-07-25T14:00:00.000Z" },
      ],
      lunchProvidedByOffice: false,
      currentHour: 20,
    });
    const gapInsight = insights.find((i) => i.id === "nutrition.meal_gap_too_long");
    expect(gapInsight).toBeDefined();
    expect(gapInsight?.urgency).toBe("now");
  });

  it("reminds to log a meal when nothing has been logged by mid-morning", () => {
    const insights = runNutritionEngine({
      today: makeToday({ proteinConsumedG: 110 }),
      goals: GOALS,
      todaysMealTimestamps: [],
      lunchProvidedByOffice: false,
      currentHour: 11,
    });
    expect(insights.some((i) => i.id === "nutrition.no_meals_logged_yet")).toBe(true);
  });
});

describe("runNutritionEngine — office schedule awareness", () => {
  it("reminds about office lunch mid-afternoon if not yet logged", () => {
    const insights = runNutritionEngine({
      today: makeToday({ proteinConsumedG: 110 }),
      goals: GOALS,
      todaysMealTimestamps: [{ type: "breakfast", loggedAt: "2026-07-25T07:00:00.000Z" }],
      lunchProvidedByOffice: true,
      currentHour: 14,
    });
    expect(insights.some((i) => i.id === "nutrition.office_lunch_reminder")).toBe(true);
  });

  it("does not remind about office lunch when it isn't office-provided", () => {
    const insights = runNutritionEngine({
      today: makeToday({ proteinConsumedG: 110 }),
      goals: GOALS,
      todaysMealTimestamps: [],
      lunchProvidedByOffice: false,
      currentHour: 14,
    });
    expect(insights.some((i) => i.id === "nutrition.office_lunch_reminder")).toBe(false);
  });

  it("does not remind about office lunch once it's been logged", () => {
    const insights = runNutritionEngine({
      today: makeToday({ proteinConsumedG: 110 }),
      goals: GOALS,
      todaysMealTimestamps: [{ type: "lunch", loggedAt: "2026-07-25T12:00:00.000Z" }],
      lunchProvidedByOffice: true,
      currentHour: 14,
    });
    expect(insights.some((i) => i.id === "nutrition.office_lunch_reminder")).toBe(false);
  });
});
