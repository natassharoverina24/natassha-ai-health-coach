import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { DailyPlan, PlannerUserContext } from "./plannerTypes";
import {
  rankMealCandidates,
  type MealPlan,
  type MealRecommendation,
} from "./mealPlanner";
import { toHHmm, toMinutes } from "./plannerHelpers";

export interface AdaptivePlan {
  date: string;
  dailyPlan: DailyPlan;
  mealPlan: MealPlan;
}

export interface AdaptiveAdjustmentInput {
  plan: AdaptivePlan;
  decision: CoachDecision;
}

export type AdaptiveAdjustmentType =
  | "bigger-dinner"
  | "shorter-workout"
  | "moved-workout"
  | "earlier-water-reminder"
  | "weekend-treat";

interface AdjustmentBase {
  type: AdaptiveAdjustmentType;
  reasonInsightId: string;
}

export type AdaptiveAdjustment =
  | (AdjustmentBase & {
      type: "bigger-dinner";
      previousTemplateId: string;
      selectedTemplateId: string;
    })
  | (AdjustmentBase & {
      type: "shorter-workout";
      previousMinutes: number;
      adjustedMinutes: number;
    })
  | (AdjustmentBase & {
      type: "moved-workout" | "earlier-water-reminder";
      previousTime: string;
      adjustedTime: string;
    })
  | (AdjustmentBase & {
      type: "weekend-treat";
      slot: "lunch" | "dinner";
      representation: "planned-flexible-meal-without-compensation";
    });

export interface PlannedFlexibleMeal {
  kind: "planned-flexible-meal-without-compensation";
  slot: "lunch" | "dinner";
  reasonInsightId: string;
}

export interface AdaptiveMealPlan {
  breakfast: MealRecommendation | PlannedFlexibleMeal;
  lunch: MealRecommendation | PlannedFlexibleMeal;
  snack: MealRecommendation | PlannedFlexibleMeal;
  dinner: MealRecommendation | PlannedFlexibleMeal;
}

export interface AdjustedAdaptivePlan {
  date: string;
  dailyPlan: DailyPlan;
  mealPlan: AdaptiveMealPlan;
}

export type AdaptiveAdjustmentError =
  | { code: "invalid-date"; field: "plan.date" }
  | {
      code: "invalid-clock";
      field:
        | "plan.dailyPlan.schedule.workout.time"
        | "plan.dailyPlan.schedule.waterReminder.time";
    }
  | { code: "missing-plan-component"; field: string };

export type AdaptiveAdjustmentResult =
  | {
      status: "success";
      plan: AdjustedAdaptivePlan;
      adjustments: AdaptiveAdjustment[];
    }
  | {
      status: "not-applicable";
      reason: "no-retained-adaptive-insight" | "no-supported-adjustment";
    }
  | {
      status: "invalid-input";
      errors: AdaptiveAdjustmentError[];
    };

const WEEKEND_TREAT_ID = "adaptive.weekend_dessert_pattern";
const LATE_NIGHT_HUNGER_ID = "adaptive.late_night_hunger_pattern";
const SKIPPED_WORKOUT_ID = "adaptive.skipped_workout_day_pattern";
const LOW_HYDRATION_ID = "adaptive.low_hydration_pattern";
const STRESS_EATING_ID = "adaptive.stress_eating_pattern";
const ADAPTIVE_INSIGHT_IDS = new Set([
  WEEKEND_TREAT_ID,
  LATE_NIGHT_HUNGER_ID,
  SKIPPED_WORKOUT_ID,
  LOW_HYDRATION_ID,
  STRESS_EATING_ID,
]);

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isClock(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validateInput(input: AdaptiveAdjustmentInput): AdaptiveAdjustmentError[] {
  const errors: AdaptiveAdjustmentError[] = [];
  if (!input?.plan) {
    return [{ code: "missing-plan-component", field: "plan" }];
  }
  if (!input.plan.dailyPlan) {
    errors.push({ code: "missing-plan-component", field: "plan.dailyPlan" });
  }
  if (!input.plan.mealPlan) {
    errors.push({ code: "missing-plan-component", field: "plan.mealPlan" });
  }
  if (!isIsoDate(input.plan.date)) {
    errors.push({ code: "invalid-date", field: "plan.date" });
  }
  if (!input.plan.dailyPlan || !input.plan.mealPlan) {
    return errors;
  }

  const { schedule } = input.plan.dailyPlan;
  if (!schedule?.workout) {
    errors.push({
      code: "missing-plan-component",
      field: "plan.dailyPlan.schedule.workout",
    });
  } else if (!isClock(schedule.workout.time)) {
    errors.push({
      code: "invalid-clock",
      field: "plan.dailyPlan.schedule.workout.time",
    });
  }
  if (!schedule?.waterReminder) {
    errors.push({
      code: "missing-plan-component",
      field: "plan.dailyPlan.schedule.waterReminder",
    });
  } else if (!isClock(schedule.waterReminder.time)) {
    errors.push({
      code: "invalid-clock",
      field: "plan.dailyPlan.schedule.waterReminder.time",
    });
  }
  for (const slot of ["breakfast", "lunch", "snack", "dinner"] as const) {
    if (!input.plan.mealPlan[slot]) {
      errors.push({
        code: "missing-plan-component",
        field: `plan.mealPlan.${slot}`,
      });
    }
  }
  return errors;
}

function clonePlan(plan: AdaptivePlan): AdjustedAdaptivePlan {
  return {
    date: plan.date,
    dailyPlan: {
      ...plan.dailyPlan,
      targets: { ...plan.dailyPlan.targets },
      schedule: {
        breakfast: { ...plan.dailyPlan.schedule.breakfast },
        lunch: { ...plan.dailyPlan.schedule.lunch },
        snack: { ...plan.dailyPlan.schedule.snack },
        dinner: { ...plan.dailyPlan.schedule.dinner },
        workout: { ...plan.dailyPlan.schedule.workout },
        waterReminder: { ...plan.dailyPlan.schedule.waterReminder },
      },
      summary: {
        ...plan.dailyPlan.summary,
        topPriority: plan.dailyPlan.summary.topPriority
          ? { ...plan.dailyPlan.summary.topPriority }
          : null,
        biggestRisk: plan.dailyPlan.summary.biggestRisk
          ? { ...plan.dailyPlan.summary.biggestRisk }
          : null,
        todaysWin: plan.dailyPlan.summary.todaysWin
          ? { ...plan.dailyPlan.summary.todaysWin }
          : null,
      },
    },
    mealPlan: {
      breakfast: { ...plan.mealPlan.breakfast },
      lunch: { ...plan.mealPlan.lunch },
      snack: { ...plan.mealPlan.snack },
      dinner: { ...plan.mealPlan.dinner },
    },
  };
}

function rankingContext(plan: AdaptivePlan): PlannerUserContext {
  return {
    today: plan.date,
    currentHour: 0,
    currentMinute: 0,
    leaveHomeTime: plan.dailyPlan.schedule.breakfast.time,
    arriveHomeTime: plan.dailyPlan.schedule.dinner.time,
    lunchProvidedByOffice: false,
    calorieGoal: plan.dailyPlan.targets.calories,
    proteinGoalG: plan.dailyPlan.targets.proteinG,
    waterGoalMl: plan.dailyPlan.targets.waterMl,
    workoutGoalMinPerDay: plan.dailyPlan.targets.workoutMin,
    stepsGoal: plan.dailyPlan.targets.steps,
    sleepGoalHours: plan.dailyPlan.targets.sleepHours,
  };
}

function requestsWorkoutMove(recommendedAction: string): boolean {
  return /\bmov(?:e|ing)\b.*\bworkout\b|\bworkout\b.*\b(?:move|moving|earlier)\b/i
    .test(recommendedAction);
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function applyAdaptiveAdjustments(
  input: AdaptiveAdjustmentInput,
): AdaptiveAdjustmentResult {
  const errors = validateInput(input);
  if (errors.length > 0) {
    return { status: "invalid-input", errors };
  }

  const retainedAdaptiveInsights = input.decision.insights.filter((insight) =>
    ADAPTIVE_INSIGHT_IDS.has(insight.id),
  );
  if (retainedAdaptiveInsights.length === 0) {
    return { status: "not-applicable", reason: "no-retained-adaptive-insight" };
  }

  const insightById = new Map(
    retainedAdaptiveInsights.map((insight) => [insight.id, insight]),
  );
  const adjustedPlan = clonePlan(input.plan);
  const adjustments: AdaptiveAdjustment[] = [];

  const lateNightInsight = insightById.get(LATE_NIGHT_HUNGER_ID);
  if (lateNightInsight) {
    const existingDinner = input.plan.mealPlan.dinner;
    const candidate = rankMealCandidates(
      input.decision,
      rankingContext(input.plan),
      "dinner",
    ).find(
      ({ template }) =>
        template.id !== existingDinner.template.id &&
        template.calories > existingDinner.template.calories,
    );
    if (candidate) {
      adjustedPlan.mealPlan.dinner = {
        slot: "dinner",
        template: candidate.template,
        reason: candidate.reason,
      };
      adjustments.push({
        type: "bigger-dinner",
        reasonInsightId: lateNightInsight.id,
        previousTemplateId: existingDinner.template.id,
        selectedTemplateId: candidate.template.id,
      });
    }
  }

  const skippedWorkoutInsight = insightById.get(SKIPPED_WORKOUT_ID);
  if (skippedWorkoutInsight) {
    const previousMinutes = input.plan.dailyPlan.targets.workoutMin;
    const rounded = Math.round((previousMinutes * 0.75) / 5) * 5;
    const adjustedMinutes = Math.min(
      previousMinutes,
      Math.max(10, rounded),
    );
    if (adjustedMinutes < previousMinutes) {
      adjustedPlan.dailyPlan.targets.workoutMin = adjustedMinutes;
      adjustments.push({
        type: "shorter-workout",
        reasonInsightId: skippedWorkoutInsight.id,
        previousMinutes,
        adjustedMinutes,
      });
    }

    if (requestsWorkoutMove(skippedWorkoutInsight.recommendedAction)) {
      const previousTime = input.plan.dailyPlan.schedule.workout.time;
      const adjustedMinutesFromMidnight = toMinutes(previousTime) - 60;
      const wakeBoundary = toMinutes(input.plan.dailyPlan.schedule.breakfast.time);
      const documentedConflictTimes = Object.entries(input.plan.dailyPlan.schedule)
        .filter(([key]) => key !== "workout")
        .map(([, slot]) => slot.time);
      const adjustedTime = toHHmm(adjustedMinutesFromMidnight);
      if (
        adjustedMinutesFromMidnight >= wakeBoundary &&
        !documentedConflictTimes.includes(adjustedTime)
      ) {
        adjustedPlan.dailyPlan.schedule.workout.time = adjustedTime;
        adjustments.push({
          type: "moved-workout",
          reasonInsightId: skippedWorkoutInsight.id,
          previousTime,
          adjustedTime,
        });
      }
    }
  }

  const hydrationInsight = insightById.get(LOW_HYDRATION_ID);
  if (hydrationInsight) {
    const previousTime = input.plan.dailyPlan.schedule.waterReminder.time;
    const previousMinutes = toMinutes(previousTime);
    const wakeBoundary = toMinutes(input.plan.dailyPlan.schedule.breakfast.time);
    if (previousMinutes - wakeBoundary >= 30) {
      const adjustedTime = toHHmm(previousMinutes - 30);
      adjustedPlan.dailyPlan.schedule.waterReminder.time = adjustedTime;
      adjustments.push({
        type: "earlier-water-reminder",
        reasonInsightId: hydrationInsight.id,
        previousTime,
        adjustedTime,
      });
    }
  }

  const weekendInsight = insightById.get(WEEKEND_TREAT_ID);
  if (weekendInsight && isWeekend(input.plan.date)) {
    const slot: "dinner" | "lunch" = input.plan.mealPlan.dinner
      ? "dinner"
      : "lunch";
    adjustedPlan.mealPlan[slot] = {
      kind: "planned-flexible-meal-without-compensation",
      slot,
      reasonInsightId: weekendInsight.id,
    };
    adjustments.push({
      type: "weekend-treat",
      reasonInsightId: weekendInsight.id,
      slot,
      representation: "planned-flexible-meal-without-compensation",
    });
  }

  if (adjustments.length === 0) {
    return { status: "not-applicable", reason: "no-supported-adjustment" };
  }

  return { status: "success", plan: adjustedPlan, adjustments };
}
