import { buildCalorieSummary } from "@/lib/coach-plan/buildCalorieSummary";
import type { WorkoutEntry } from "@/types/firestore";

const workout: WorkoutEntry = {
  id: "workout-1",
  createdAt: "2026-08-02T08:00:00.000Z",
  updatedAt: "2026-08-02T08:00:00.000Z",
  userId: "user-1",
  date: "2026-08-02",
  name: "Treadmill",
  durationMin: 30,
  caloriesBurnedKcal: 189,
  calorieEstimate: {
    method: "met-local",
    estimatedCaloriesKcal: 189,
    confirmedCaloriesKcal: 189,
    met: 6,
    weightKgUsed: 60,
    userConfirmed: true,
    wasEdited: false,
    assumptions: ["Local estimate"],
    estimatedAt: "2026-08-02T08:00:00.000Z",
  },
  note: null,
};

describe("buildCalorieSummary", () => {
  it("calculates eaten, workout, net, and remaining calories", () => {
    const result = buildCalorieSummary({
      today: "2026-08-02",
      caloriesEatenKcal: 900,
      mealsStatus: "available",
      workouts: { status: "available", data: [workout] },
      targetCaloriesKcal: 1400,
    });
    expect(result).toMatchObject({
      status: "ready",
      caloriesEaten: { value: 900 },
      workoutCaloriesBurned: { value: 189, status: "estimated" },
      netCalories: { value: 711 },
      remainingCalories: { value: 689 },
    });
  });

  it("labels no workout as empty without showing a raw burned zero", () => {
    const result = buildCalorieSummary({
      today: "2026-08-02",
      caloriesEatenKcal: 900,
      mealsStatus: "available",
      workouts: { status: "empty", data: [] },
      targetCaloriesKcal: 1400,
    });
    expect(result.workoutCaloriesBurned).toMatchObject({ value: null, status: "empty" });
    expect(result.netCalories.value).toBe(900);
  });

  it("returns partial output when target or confirmed workout calories are missing", () => {
    const legacyWorkout = { ...workout, caloriesBurnedKcal: undefined, calorieEstimate: undefined };
    const result = buildCalorieSummary({
      today: "2026-08-02",
      caloriesEatenKcal: 900,
      mealsStatus: "available",
      workouts: { status: "available", data: [legacyWorkout] },
      targetCaloriesKcal: null,
    });
    expect(result.status).toBe("partial");
    expect(result.netCalories.value).toBeNull();
    expect(result.remainingCalories.value).toBeNull();
  });
});
