import type { DataSourceResult } from "./availability";
import type { DailyCalorieSummary, MetricStatus, MetricValue } from "./types";
import type { WorkoutEntry } from "@/types/firestore";

interface BuildCalorieSummaryInput {
  today: string;
  caloriesEatenKcal: number | null;
  mealsStatus: DataSourceResult<unknown>["status"];
  workouts: DataSourceResult<WorkoutEntry[]>;
  targetCaloriesKcal: number | null;
}

function unavailable(status: DataSourceResult<unknown>["status"]): boolean {
  return status === "unavailable" || status === "stale";
}

function metric(
  value: number | null,
  status: MetricStatus,
  sourceIds: string[],
): MetricValue {
  return { value, unit: "kcal", status, sourceIds };
}

/** Display arithmetic only; it does not alter calorie targets or coaching decisions. */
export function buildCalorieSummary(
  input: BuildCalorieSummaryInput,
): DailyCalorieSummary {
  const mealsUnavailable = unavailable(input.mealsStatus);
  const workoutsUnavailable = unavailable(input.workouts.status);
  const todaysWorkouts = input.workouts.data.filter(
    (workout) => workout.date === input.today,
  );
  const confirmedWorkoutCalories = todaysWorkouts.filter(
    (workout) =>
      workout.calorieEstimate?.userConfirmed === true &&
      Number.isFinite(workout.caloriesBurnedKcal) &&
      (workout.caloriesBurnedKcal ?? 0) > 0,
  );
  const allWorkoutCaloriesKnown =
    todaysWorkouts.length === confirmedWorkoutCalories.length;
  const workoutCalories = confirmedWorkoutCalories.reduce(
    (sum, workout) => sum + (workout.caloriesBurnedKcal ?? 0),
    0,
  );
  const caloriesEaten =
    mealsUnavailable || input.mealsStatus === "empty"
      ? null
      : input.caloriesEatenKcal;
  const canUseWorkoutCalories =
    !workoutsUnavailable &&
    (todaysWorkouts.length === 0 || allWorkoutCaloriesKnown);
  const netCalories =
    caloriesEaten !== null && canUseWorkoutCalories
      ? caloriesEaten - workoutCalories
      : null;
  const remainingCalories =
    netCalories !== null && input.targetCaloriesKcal !== null
      ? input.targetCaloriesKcal - netCalories
      : null;

  return {
    status:
      mealsUnavailable ||
      workoutsUnavailable ||
      !allWorkoutCaloriesKnown ||
      input.targetCaloriesKcal === null
        ? "partial"
        : "ready",
    caloriesEaten: metric(
      caloriesEaten,
      mealsUnavailable
        ? "unavailable"
        : input.mealsStatus === "empty"
          ? "empty"
          : "ready",
      ["repository.meals"],
    ),
    workoutCaloriesBurned: metric(
      workoutsUnavailable
        ? null
        : todaysWorkouts.length === 0
          ? null
          : allWorkoutCaloriesKnown
            ? workoutCalories
            : null,
      workoutsUnavailable
        ? "unavailable"
        : todaysWorkouts.length === 0
          ? "empty"
          : allWorkoutCaloriesKnown
            ? "estimated"
            : "empty",
      ["repository.workouts", "activity-tracking.met-local"],
    ),
    netCalories: metric(
      netCalories,
      netCalories === null
        ? workoutsUnavailable || mealsUnavailable
          ? "unavailable"
          : "empty"
        : "ready",
      ["repository.meals", "repository.workouts"],
    ),
    remainingCalories: metric(
      remainingCalories,
      remainingCalories === null
        ? workoutsUnavailable || mealsUnavailable
          ? "unavailable"
          : "empty"
        : "ready",
      [
        "repository.meals",
        "repository.workouts",
        "planner.daily.targets.calories",
      ],
    ),
    targetCaloriesKcal: input.targetCaloriesKcal,
    workoutEntryCount: todaysWorkouts.length,
    unresolvedWorkoutCount:
      todaysWorkouts.length - confirmedWorkoutCalories.length,
    formula: "net = eaten - workout; remaining = target - net",
    sourceIds: [
      "repository.meals",
      "repository.workouts",
      "planner.daily.targets.calories",
      "activity-tracking.met-local",
    ],
  };
}
