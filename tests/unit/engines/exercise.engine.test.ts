import { runExerciseEngine } from "@/lib/engines/exercise.engine";

describe("runExerciseEngine — prioritize adherence", () => {
  it("flags adherence risk at 3+ days since the last workout, and suppresses other exercise noise", () => {
    const insights = runExerciseEngine({
      todayWorkoutMinutes: 0,
      workoutGoalMinPerDay: 30,
      recentWorkoutNames: [],
      daysSinceLastWorkout: 3,
      currentHour: 18,
    });
    expect(insights).toHaveLength(1);
    expect(insights[0].id).toBe("exercise.adherence_risk");
    expect(insights[0].priority).toBe("high");
  });

  it("does not flag adherence risk below the 3-day threshold", () => {
    const insights = runExerciseEngine({
      todayWorkoutMinutes: 0,
      workoutGoalMinPerDay: 30,
      recentWorkoutNames: [],
      daysSinceLastWorkout: 2,
      currentHour: 18,
    });
    expect(insights.some((i) => i.id === "exercise.adherence_risk")).toBe(false);
  });
});

describe("runExerciseEngine — minimum action rule / walking default", () => {
  it("suggests a walk in the evening when the goal isn't met and HIIT hasn't been frequent recently", () => {
    const insights = runExerciseEngine({
      todayWorkoutMinutes: 0,
      workoutGoalMinPerDay: 30,
      recentWorkoutNames: ["Walk", "Walk"],
      daysSinceLastWorkout: 1,
      currentHour: 18,
    });
    const minimum = insights.find((i) => i.id === "exercise.minimum_action");
    expect(minimum).toBeDefined();
    expect(minimum?.data?.hiitOptional).toBe(false);
    expect(minimum?.recommendedAction).toMatch(/walk/i);
  });

  it("offers HIIT as optional when it's been done recently", () => {
    const insights = runExerciseEngine({
      todayWorkoutMinutes: 0,
      workoutGoalMinPerDay: 30,
      recentWorkoutNames: ["HIIT session", "Walk", "HIIT intervals"],
      daysSinceLastWorkout: 1,
      currentHour: 18,
    });
    const minimum = insights.find((i) => i.id === "exercise.minimum_action");
    expect(minimum?.data?.hiitOptional).toBe(true);
  });

  it("does not suggest anything before the evening window", () => {
    const insights = runExerciseEngine({
      todayWorkoutMinutes: 0,
      workoutGoalMinPerDay: 30,
      recentWorkoutNames: [],
      daysSinceLastWorkout: 1,
      currentHour: 10,
    });
    expect(insights.some((i) => i.id === "exercise.minimum_action")).toBe(false);
  });

  it("does not suggest anything once the goal is already met today", () => {
    const insights = runExerciseEngine({
      todayWorkoutMinutes: 30,
      workoutGoalMinPerDay: 30,
      recentWorkoutNames: [],
      daysSinceLastWorkout: 0,
      currentHour: 18,
    });
    expect(insights.some((i) => i.id === "exercise.minimum_action")).toBe(false);
  });
});
