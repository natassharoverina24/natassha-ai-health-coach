import {
  ageFromDateOfBirth,
  buildDailyLogInputs,
  calculateEnergy,
  computeDailyCoachScore,
} from "@/lib/coach";
import type { DailyGoals } from "@/lib/coach";
import type { DataSourceResult } from "@/lib/coach-plan/availability";
import type {
  DailyMetricSummary,
  GoalMetricValue,
  MetricStatus,
  MetricValue,
} from "@/lib/coach-plan/types";
import type { DailyTargets } from "@/lib/planner";
import type {
  MealEntry,
  SleepEntry,
  UserProfile,
  WaistEntry,
  WaterLogEntry,
  WeightEntry,
  WorkoutEntry,
} from "@/types/firestore";
import { buildCalorieSummary } from "./buildCalorieSummary";

interface BuildMetricSummaryInput {
  today: string;
  targets: DailyTargets;
  profile: DataSourceResult<UserProfile | null>;
  weights: DataSourceResult<WeightEntry[]>;
  waists: DataSourceResult<WaistEntry[]>;
  meals: DataSourceResult<MealEntry[]>;
  water: DataSourceResult<WaterLogEntry[]>;
  workouts: DataSourceResult<WorkoutEntry[]>;
  sleep: DataSourceResult<SleepEntry[]>;
}

const CORE_METRIC_SOURCE_IDS = [
  "repository.meals",
  "repository.water",
  "repository.workouts",
  "repository.sleep",
];

function isUnavailable(status: DataSourceResult<unknown>["status"]): boolean {
  return status === "unavailable" || status === "stale";
}

function metricStatus(
  source: DataSourceResult<unknown>,
): Exclude<MetricStatus, "estimated"> {
  if (isUnavailable(source.status)) return "unavailable";
  return source.status === "empty" ? "empty" : "ready";
}

function goalMetric(
  value: number | null,
  target: number,
  unit: string,
  status: Exclude<MetricStatus, "estimated">,
  sourceIds: string[],
): GoalMetricValue {
  if (status === "unavailable" || value === null) {
    return {
      value,
      unit,
      status,
      target,
      remaining: null,
      progressPercent: null,
      sourceIds,
    };
  }
  return {
    value,
    unit,
    status,
    target,
    remaining: Math.max(0, target - value),
    progressPercent:
      target > 0 ? Math.round((value / target) * 100) : null,
    sourceIds,
  };
}

function bodyMetric(
  value: number | null,
  unit: string,
  status: Exclude<MetricStatus, "estimated">,
  sourceIds: string[],
): MetricValue {
  return { value, unit, status, sourceIds };
}

/**
 * Builds display-ready health metrics from existing targets, logs, and
 * approved deterministic coach utilities. It makes no coaching decisions.
 */
export function buildMetricSummary(
  input: BuildMetricSummaryInput,
): DailyMetricSummary {
  const dailyInput = buildDailyLogInputs(
    [input.today],
    {
      meals: input.meals.data,
      waterLogs: input.water.data,
      workouts: input.workouts.data,
      sleepLogs: input.sleep.data,
    },
  )[0];
  const goals: DailyGoals = {
    calorieGoal: input.targets.calories,
    proteinGoalG: input.targets.proteinG,
    waterGoalMl: input.targets.waterMl,
    workoutGoalMinPerDay: input.targets.workoutMin,
    sleepGoalHours: input.targets.sleepHours,
  };
  const coreSources = [
    input.meals,
    input.water,
    input.workouts,
    input.sleep,
  ];
  const coachScoreStatus: Exclude<MetricStatus, "estimated"> =
    coreSources.some((source) => isUnavailable(source.status))
      ? "unavailable"
      : coreSources.every((source) => source.status === "empty")
        ? "empty"
        : "ready";
  const coachScore =
    coachScoreStatus === "ready"
      ? computeDailyCoachScore(dailyInput, goals).overall
      : null;

  const latestWeight = input.weights.data[0] ?? null;
  const latestWaist = input.waists.data[0] ?? null;
  const weightStatus = metricStatus(input.weights);
  const waistStatus = metricStatus(input.waists);
  const energyWeightKg =
    weightStatus === "ready"
      ? latestWeight?.weightKg
      : input.profile.data?.startWeightKg;
  const profile = input.profile.data;
  const age = profile
    ? ageFromDateOfBirth(profile.dateOfBirth, input.today)
    : null;
  const energy =
    energyWeightKg != null &&
    profile != null &&
    age != null &&
    (profile.sex === "female" || profile.sex === "male")
      ? calculateEnergy({
          weightKg: energyWeightKg,
          heightCm: profile.heightCm,
          age,
          sex: profile.sex,
          activityLevel: "light",
        })
      : null;
  const estimatedEnergy = energy?.status === "success" ? energy : null;
  const energySourceIds = [
    "coach.energy-calculator",
    latestWeight ? "repository.weights" : "repository.profile.startWeightKg",
    "repository.profile",
  ];
  const trend =
    weightStatus === "ready" && input.weights.data.length >= 2
      ? {
          metric: "weightKg" as const,
          direction:
            input.weights.data[0].weightKg > input.weights.data[1].weightKg
              ? ("up" as const)
              : input.weights.data[0].weightKg <
                  input.weights.data[1].weightKg
                ? ("down" as const)
                : ("flat" as const),
          change:
            Math.round(
              (input.weights.data[0].weightKg -
                input.weights.data[1].weightKg) *
                10,
            ) / 10,
          unit: "kg" as const,
          sourceIds: ["repository.weights"],
        }
      : null;

  return {
    coachScore: {
      value: coachScore,
      unit: "/100",
      status: coachScoreStatus,
      sourceIds: ["coach.daily-score", ...CORE_METRIC_SOURCE_IDS],
    },
    calories: goalMetric(
      isUnavailable(input.meals.status) ? null : dailyInput.caloriesConsumed,
      input.targets.calories,
      "kcal",
      metricStatus(input.meals),
      ["repository.meals", "planner.daily.targets.calories"],
    ),
    protein: goalMetric(
      isUnavailable(input.meals.status) ? null : dailyInput.proteinConsumedG,
      input.targets.proteinG,
      "g",
      metricStatus(input.meals),
      ["repository.meals", "planner.daily.targets.proteinG"],
    ),
    water: goalMetric(
      isUnavailable(input.water.status) ? null : dailyInput.waterMl,
      input.targets.waterMl,
      "ml",
      metricStatus(input.water),
      ["repository.water", "planner.daily.targets.waterMl"],
    ),
    sleep: goalMetric(
      isUnavailable(input.sleep.status) ? null : dailyInput.sleepHours,
      input.targets.sleepHours,
      "h",
      metricStatus(input.sleep),
      ["repository.sleep", "planner.daily.targets.sleepHours"],
    ),
    workout: goalMetric(
      isUnavailable(input.workouts.status)
        ? null
        : dailyInput.workoutMinutes,
      input.targets.workoutMin,
      "min",
      metricStatus(input.workouts),
      ["repository.workouts", "planner.daily.targets.workoutMin"],
    ),
    calorieSummary: buildCalorieSummary({
      today: input.today,
      caloriesEatenKcal: isUnavailable(input.meals.status)
        ? null
        : dailyInput.caloriesConsumed,
      mealsStatus: input.meals.status,
      workouts: input.workouts,
      targetCaloriesKcal: input.targets.calories,
    }),
    body: {
      weightKg: bodyMetric(
        latestWeight?.weightKg ?? null,
        "kg",
        weightStatus,
        ["repository.weights"],
      ),
      waistCm: bodyMetric(
        latestWaist?.waistCm ?? null,
        "cm",
        waistStatus,
        ["repository.waists"],
      ),
      bmrKcal: {
        value: estimatedEnergy?.bmrCalories ?? null,
        unit: "kcal",
        status: estimatedEnergy ? "estimated" : "empty",
        sourceIds: energySourceIds,
      },
      tdeeKcal: {
        value: estimatedEnergy?.tdeeCalories ?? null,
        unit: "kcal",
        status: estimatedEnergy ? "estimated" : "empty",
        sourceIds: energySourceIds,
      },
      deficitKcal: {
        value: estimatedEnergy
          ? estimatedEnergy.tdeeCalories - input.targets.calories
          : null,
        unit: "kcal",
        status: estimatedEnergy ? "estimated" : "empty",
        sourceIds: [
          ...energySourceIds,
          "planner.daily.targets.calories",
        ],
      },
      trend,
    },
  };
}
