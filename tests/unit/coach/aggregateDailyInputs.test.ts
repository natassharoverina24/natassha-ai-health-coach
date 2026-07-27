import { buildDailyLogInputs } from "@/lib/coach/aggregateDailyInputs";
import type { MealEntry, SleepEntry, WaterLogEntry, WorkoutEntry } from "@/types/firestore";

function makeMeal(overrides: Partial<MealEntry> = {}): MealEntry {
  return {
    id: "m1",
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
    userId: "u1",
    date: "2026-07-25",
    type: "breakfast",
    name: "Oats",
    quantity: null,
    isOfficeLunch: false,
    macros: { calories: 300, proteinG: 10, carbsG: 40, fatG: 5, fiberG: 4 },
    photoIds: [],
    score: null,
    note: null,
    ...overrides,
  };
}

function makeWater(amountMl: number, date = "2026-07-25"): WaterLogEntry {
  return {
    id: `w-${amountMl}-${date}`,
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
    userId: "u1",
    date,
    amountMl,
    loggedAt: "2026-07-25T08:00:00.000Z",
  };
}

function makeWorkout(durationMin: number, date = "2026-07-25"): WorkoutEntry {
  return {
    id: `wo-${durationMin}-${date}`,
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
    userId: "u1",
    date,
    name: "Run",
    durationMin,
    note: null,
  };
}

function makeSleep(hoursSlept: number, date = "2026-07-25"): SleepEntry {
  return {
    id: `s-${date}`,
    createdAt: "2026-07-25T08:00:00.000Z",
    updatedAt: "2026-07-25T08:00:00.000Z",
    userId: "u1",
    date,
    hoursSlept,
    note: null,
  };
}

describe("buildDailyLogInputs", () => {
  it("returns one entry per requested date, in order", () => {
    const result = buildDailyLogInputs(["2026-07-24", "2026-07-25"], {
      meals: [],
      waterLogs: [],
      workouts: [],
      sleepLogs: [],
    });
    expect(result.map((r) => r.date)).toEqual(["2026-07-24", "2026-07-25"]);
  });

  it("sums calories and protein from meals logged on that date only", () => {
    const meals = [
      makeMeal({ date: "2026-07-25", macros: { calories: 300, proteinG: 10, carbsG: 40, fatG: 5, fiberG: 4 } }),
      makeMeal({ date: "2026-07-25", macros: { calories: 200, proteinG: 15, carbsG: 20, fatG: 2, fiberG: 1 } }),
      makeMeal({ date: "2026-07-24", macros: { calories: 999, proteinG: 99, carbsG: 99, fatG: 99, fiberG: 99 } }),
    ];
    const [result] = buildDailyLogInputs(["2026-07-25"], { meals, waterLogs: [], workouts: [], sleepLogs: [] });
    expect(result.caloriesConsumed).toBe(500);
    expect(result.proteinConsumedG).toBe(25);
  });

  it("sums water and workout minutes for the date", () => {
    const [result] = buildDailyLogInputs(["2026-07-25"], {
      meals: [],
      waterLogs: [makeWater(250), makeWater(500)],
      workouts: [makeWorkout(20), makeWorkout(10)],
      sleepLogs: [],
    });
    expect(result.waterMl).toBe(750);
    expect(result.workoutMinutes).toBe(30);
  });

  it("uses the matching sleep entry's hours, or null when none exists", () => {
    const [withSleep] = buildDailyLogInputs(["2026-07-25"], {
      meals: [],
      waterLogs: [],
      workouts: [],
      sleepLogs: [makeSleep(7.5)],
    });
    expect(withSleep.sleepHours).toBe(7.5);

    const [withoutSleep] = buildDailyLogInputs(["2026-07-26"], {
      meals: [],
      waterLogs: [],
      workouts: [],
      sleepLogs: [makeSleep(7.5, "2026-07-25")],
    });
    expect(withoutSleep.sleepHours).toBeNull();
  });

  it("collects the distinct meal types logged that day", () => {
    const meals = [
      makeMeal({ date: "2026-07-25", type: "breakfast" }),
      makeMeal({ date: "2026-07-25", type: "lunch" }),
      makeMeal({ date: "2026-07-25", type: "lunch" }),
    ];
    const [result] = buildDailyLogInputs(["2026-07-25"], { meals, waterLogs: [], workouts: [], sleepLogs: [] });
    expect(result.mealTypesLogged.sort()).toEqual(["breakfast", "lunch"]);
  });
});
