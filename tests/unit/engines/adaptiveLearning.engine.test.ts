import {
  buildHistoricalDayRecords,
  runAdaptiveLearningEngine,
  type HistoricalDayRecord,
} from "@/lib/engines/adaptiveLearning.engine";

function day(overrides: Partial<HistoricalDayRecord>): HistoricalDayRecord {
  return {
    date: "2026-07-01",
    dayOfWeek: 3,
    waterAdherencePercent: 100,
    workoutMinutes: 30,
    sleepHours: 7,
    caloriesConsumed: 1400,
    calorieGoal: 1400,
    lateNightMealLogged: false,
    dessertLikeMealLogged: false,
    ...overrides,
  };
}

describe("buildHistoricalDayRecords", () => {
  it("aggregates calories from meals on each date, and dayOfWeek from the date string", () => {
    const records = buildHistoricalDayRecords(["2026-07-25"], {
      meals: [
        { date: "2026-07-25", name: "Rice", createdAt: "2026-07-25T08:00:00.000Z", calories: 200 },
        { date: "2026-07-25", name: "Chicken", createdAt: "2026-07-25T08:10:00.000Z", calories: 220 },
        { date: "2026-07-24", name: "Fish", createdAt: "2026-07-24T08:00:00.000Z", calories: 999 },
      ],
      waterMlByDate: new Map(),
      workoutMinutesByDate: new Map(),
      sleepHoursByDate: new Map(),
      waterGoalMl: 2000,
      calorieGoal: 1400,
    });
    expect(records[0].caloriesConsumed).toBe(420);
    // 2026-07-25 is a Saturday
    expect(records[0].dayOfWeek).toBe(6);
  });

  it("flags a dessert-like meal by keyword", () => {
    const records = buildHistoricalDayRecords(["2026-07-25"], {
      meals: [{ date: "2026-07-25", name: "Chocolate cake", createdAt: "2026-07-25T20:00:00.000Z", calories: 300 }],
      waterMlByDate: new Map(),
      workoutMinutesByDate: new Map(),
      sleepHoursByDate: new Map(),
      waterGoalMl: 2000,
      calorieGoal: 1400,
    });
    expect(records[0].dessertLikeMealLogged).toBe(true);
  });

  it("flags a late-night meal at or after 9pm", () => {
    const records = buildHistoricalDayRecords(["2026-07-25"], {
      meals: [{ date: "2026-07-25", name: "Snack", createdAt: new Date(2026, 6, 25, 22, 0).toISOString(), calories: 100 }],
      waterMlByDate: new Map(),
      workoutMinutesByDate: new Map(),
      sleepHoursByDate: new Map(),
      waterGoalMl: 2000,
      calorieGoal: 1400,
    });
    expect(records[0].lateNightMealLogged).toBe(true);
  });

  it("caps water adherence at 100%", () => {
    const records = buildHistoricalDayRecords(["2026-07-25"], {
      meals: [],
      waterMlByDate: new Map([["2026-07-25", 5000]]),
      workoutMinutesByDate: new Map(),
      sleepHoursByDate: new Map(),
      waterGoalMl: 2000,
      calorieGoal: 1400,
    });
    expect(records[0].waterAdherencePercent).toBe(100);
  });
});

describe("runAdaptiveLearningEngine — weekend dessert pattern", () => {
  it("detects dessert concentrated on weekends", () => {
    const history: HistoricalDayRecord[] = [
      day({ date: "s1", dayOfWeek: 6, dessertLikeMealLogged: true }),
      day({ date: "s2", dayOfWeek: 0, dessertLikeMealLogged: true }),
      day({ date: "s3", dayOfWeek: 6, dessertLikeMealLogged: true }),
      day({ date: "w1", dayOfWeek: 1, dessertLikeMealLogged: false }),
      day({ date: "w2", dayOfWeek: 2, dessertLikeMealLogged: false }),
      day({ date: "w3", dayOfWeek: 3, dessertLikeMealLogged: false }),
      day({ date: "w4", dayOfWeek: 4, dessertLikeMealLogged: false }),
    ];
    const insights = runAdaptiveLearningEngine({ history });
    expect(insights.some((i) => i.id === "adaptive.weekend_dessert_pattern")).toBe(true);
  });

  it("does not fire when dessert is just as common on weekdays", () => {
    const history: HistoricalDayRecord[] = [
      day({ date: "s1", dayOfWeek: 6, dessertLikeMealLogged: true }),
      day({ date: "s2", dayOfWeek: 0, dessertLikeMealLogged: true }),
      day({ date: "s3", dayOfWeek: 6, dessertLikeMealLogged: true }),
      day({ date: "w1", dayOfWeek: 1, dessertLikeMealLogged: true }),
      day({ date: "w2", dayOfWeek: 2, dessertLikeMealLogged: true }),
    ];
    const insights = runAdaptiveLearningEngine({ history });
    expect(insights.some((i) => i.id === "adaptive.weekend_dessert_pattern")).toBe(false);
  });
});

describe("runAdaptiveLearningEngine — late-night hunger pattern", () => {
  it("fires once late-night meals recur at least 3 times", () => {
    const history: HistoricalDayRecord[] = [
      day({ date: "d1", lateNightMealLogged: true }),
      day({ date: "d2", lateNightMealLogged: true }),
      day({ date: "d3", lateNightMealLogged: true }),
      day({ date: "d4", lateNightMealLogged: false }),
    ];
    const insights = runAdaptiveLearningEngine({ history });
    expect(insights.some((i) => i.id === "adaptive.late_night_hunger_pattern")).toBe(true);
  });

  it("does not fire for a single occurrence", () => {
    const history: HistoricalDayRecord[] = [
      day({ date: "d1", lateNightMealLogged: true }),
      day({ date: "d2", lateNightMealLogged: false }),
    ];
    const insights = runAdaptiveLearningEngine({ history });
    expect(insights.some((i) => i.id === "adaptive.late_night_hunger_pattern")).toBe(false);
  });
});

describe("runAdaptiveLearningEngine — skipped workout day-of-week pattern", () => {
  it("detects a specific day consistently skipped", () => {
    const history: HistoricalDayRecord[] = [
      day({ date: "w1", dayOfWeek: 3, workoutMinutes: 0 }),
      day({ date: "w2", dayOfWeek: 3, workoutMinutes: 0 }),
      day({ date: "w3", dayOfWeek: 3, workoutMinutes: 0 }),
      day({ date: "w4", dayOfWeek: 1, workoutMinutes: 30 }),
      day({ date: "w5", dayOfWeek: 2, workoutMinutes: 30 }),
    ];
    const insights = runAdaptiveLearningEngine({ history });
    const pattern = insights.find((i) => i.id === "adaptive.skipped_workout_day_pattern");
    expect(pattern).toBeDefined();
    expect(pattern?.data?.dayOfWeek).toBe(3);
  });

  it("does not fire when skips are spread across different days", () => {
    const history: HistoricalDayRecord[] = [
      day({ date: "w1", dayOfWeek: 1, workoutMinutes: 0 }),
      day({ date: "w2", dayOfWeek: 2, workoutMinutes: 0 }),
      day({ date: "w3", dayOfWeek: 3, workoutMinutes: 0 }),
    ];
    const insights = runAdaptiveLearningEngine({ history });
    expect(insights.some((i) => i.id === "adaptive.skipped_workout_day_pattern")).toBe(false);
  });
});

describe("runAdaptiveLearningEngine — low hydration pattern", () => {
  it("fires once low hydration recurs at least 4 times", () => {
    const history: HistoricalDayRecord[] = Array.from({ length: 4 }, (_, i) =>
      day({ date: `d${i}`, waterAdherencePercent: 20 }),
    );
    const insights = runAdaptiveLearningEngine({ history });
    expect(insights.some((i) => i.id === "adaptive.low_hydration_pattern")).toBe(true);
  });

  it("does not fire below the minimum occurrence count", () => {
    const history: HistoricalDayRecord[] = Array.from({ length: 3 }, (_, i) =>
      day({ date: `d${i}`, waterAdherencePercent: 20 }),
    );
    const insights = runAdaptiveLearningEngine({ history });
    expect(insights.some((i) => i.id === "adaptive.low_hydration_pattern")).toBe(false);
  });
});

describe("runAdaptiveLearningEngine — stress eating proxy", () => {
  it("fires when low sleep is reliably followed by calorie overshoot", () => {
    const history: HistoricalDayRecord[] = [];
    for (let i = 0; i < 3; i += 1) {
      history.push(day({ date: `low-sleep-${i}`, sleepHours: 5 }));
      history.push(day({ date: `overshoot-${i}`, caloriesConsumed: 2000, calorieGoal: 1400 }));
    }
    const insights = runAdaptiveLearningEngine({ history });
    expect(insights.some((i) => i.id === "adaptive.stress_eating_pattern")).toBe(true);
  });

  it("does not fire when overshoot doesn't follow low sleep", () => {
    const history: HistoricalDayRecord[] = [];
    for (let i = 0; i < 3; i += 1) {
      history.push(day({ date: `good-sleep-${i}`, sleepHours: 8 }));
      history.push(day({ date: `overshoot-${i}`, caloriesConsumed: 2000, calorieGoal: 1400 }));
    }
    const insights = runAdaptiveLearningEngine({ history });
    expect(insights.some((i) => i.id === "adaptive.stress_eating_pattern")).toBe(false);
  });
});

describe("runAdaptiveLearningEngine — empty history", () => {
  it("returns no insights for an empty history", () => {
    expect(runAdaptiveLearningEngine({ history: [] })).toEqual([]);
  });
});
