import { addDaysToISODate } from "@/lib/coach";
import { hasConfirmedMealNutrition } from "@/lib/utils/nutritionEstimates";
import type {
  ActiveDisruption,
  MealEntry,
  MealType,
  WaterLogEntry,
  WorkoutEntry,
} from "@/types/firestore";
import type {
  AdaptiveInsight,
  AdaptiveInsightEvidence,
  AdaptivePatternType,
} from "./types";

const WINDOW_DAYS = 14;
const MIGRAINE_WINDOW_DAYS = 28;
const MIN_OBSERVED_DAYS = 7;
const MIN_OCCURRENCES = 3;
const MIN_LOW_WATER_OCCURRENCES = 4;
const LOW_PROTEIN_RATIO = 0.8;
const LOW_WATER_RATIO = 0.6;
const MAX_INSIGHTS = 3;
const MEAL_TYPES: readonly MealType[] = [
  "breakfast",
  "lunch",
  "snack",
  "dinner",
];
const TYPE_ORDER: readonly AdaptivePatternType[] = [
  "breakfast-not-logged",
  "workout-not-logged",
  "low-protein",
  "low-water",
  "migraine-disruption",
];

export interface AdaptiveLearningInput {
  referenceDate: string;
  proteinGoalG: number;
  waterGoalMl: number;
  workoutGoalMinPerDay: number;
  meals: readonly MealEntry[] | null;
  waterLogs: readonly WaterLogEntry[] | null;
  workouts: readonly WorkoutEntry[] | null;
  disruptions: readonly ActiveDisruption[] | null;
}

interface InsightDraft {
  type: AdaptivePatternType;
  title: string;
  explanation: string;
  suggestion: string;
  evidence: AdaptiveInsightEvidence;
}

function inWindow(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function evidence(
  count: number,
  observedDays: number,
  windowDays: number,
  windowStart: string,
  windowEnd: string,
  sourceIds: readonly string[],
): AdaptiveInsightEvidence {
  return {
    count,
    observedDays,
    windowDays,
    windowStart,
    windowEnd,
    sourceIds: unique(sourceIds).sort(),
  };
}

function toInsight(draft: InsightDraft): AdaptiveInsight {
  const id = `adaptive-observation.${draft.type}`;
  return {
    id,
    type: draft.type,
    title: draft.title,
    explanation: draft.explanation,
    evidence: draft.evidence,
    suggestion: { text: draft.suggestion, applied: false },
    status: "suggested",
    sourceIds: [id, ...draft.evidence.sourceIds],
  };
}

function mealTypesByDate(meals: readonly MealEntry[]) {
  const result = new Map<string, Set<MealType>>();
  for (const meal of meals) {
    const types = result.get(meal.date) ?? new Set<MealType>();
    types.add(meal.type);
    result.set(meal.date, types);
  }
  return result;
}

/**
 * Builds explainable observations only. It never mutates a CoachDecision,
 * changes a target, or applies the suggested next step.
 */
export function buildAdaptiveInsights(
  input: AdaptiveLearningInput,
): AdaptiveInsight[] {
  const windowStart = addDaysToISODate(
    input.referenceDate,
    -(WINDOW_DAYS - 1),
  );
  const migraineWindowStart = addDaysToISODate(
    input.referenceDate,
    -(MIGRAINE_WINDOW_DAYS - 1),
  );
  const meals =
    input.meals?.filter(
      (meal) =>
        inWindow(meal.date, windowStart, input.referenceDate) &&
        hasConfirmedMealNutrition(meal),
    ) ?? null;
  const waterLogs =
    input.waterLogs?.filter((log) =>
      inWindow(log.date, windowStart, input.referenceDate),
    ) ?? null;
  const workouts =
    input.workouts?.filter((log) =>
      inWindow(log.date, windowStart, input.referenceDate),
    ) ?? null;
  const drafts: InsightDraft[] = [];

  if (meals) {
    const typesByDate = mealTypesByDate(meals);
    const completeEnoughDates = [...typesByDate.entries()]
      .filter(([, types]) => types.size >= 3)
      .map(([date]) => date);
    const missingBreakfastDates = completeEnoughDates.filter(
      (date) => !typesByDate.get(date)?.has("breakfast"),
    );
    if (
      completeEnoughDates.length >= MIN_OBSERVED_DAYS &&
      missingBreakfastDates.length >= MIN_OCCURRENCES &&
      missingBreakfastDates.length / completeEnoughDates.length >= 0.5
    ) {
      const relevant = meals.filter((meal) =>
        missingBreakfastDates.includes(meal.date),
      );
      drafts.push({
        type: "breakfast-not-logged",
        title: "Breakfast is often not logged",
        explanation:
          "On several well-logged days, lunch, snack, or dinner appeared without a breakfast entry.",
        suggestion:
          "Consider reviewing whether the existing breakfast time still fits your routine.",
        evidence: evidence(
          missingBreakfastDates.length,
          completeEnoughDates.length,
          WINDOW_DAYS,
          windowStart,
          input.referenceDate,
          relevant.map((meal) => `meal:${meal.id}`),
        ),
      });
    }

    const completeDates = [...typesByDate.entries()]
      .filter(([, types]) => MEAL_TYPES.every((type) => types.has(type)))
      .map(([date]) => date);
    const lowProteinDates =
      input.proteinGoalG > 0
        ? completeDates.filter((date) => {
            const total = meals
              .filter((meal) => meal.date === date)
              .reduce((sum, meal) => sum + meal.macros.proteinG, 0);
            return total < input.proteinGoalG * LOW_PROTEIN_RATIO;
          })
        : [];
    if (
      completeDates.length >= MIN_OBSERVED_DAYS &&
      lowProteinDates.length >= MIN_OCCURRENCES &&
      lowProteinDates.length / completeDates.length >= 0.5
    ) {
      const relevant = meals.filter((meal) =>
        lowProteinDates.includes(meal.date),
      );
      drafts.push({
        type: "low-protein",
        title: "Protein often finishes below the existing target",
        explanation:
          "Several fully logged days finished below 80% of the protein target already stored in your settings.",
        suggestion:
          "Consider checking the existing protein progress earlier in the day.",
        evidence: evidence(
          lowProteinDates.length,
          completeDates.length,
          WINDOW_DAYS,
          windowStart,
          input.referenceDate,
          relevant.map((meal) => `meal:${meal.id}`),
        ),
      });
    }
  }

  const observedDates = unique([
    ...(meals?.map((meal) => meal.date) ?? []),
    ...(waterLogs?.map((log) => log.date) ?? []),
    ...(workouts?.map((log) => log.date) ?? []),
  ]).sort();

  if (
    workouts &&
    input.workoutGoalMinPerDay > 0 &&
    observedDates.length >= MIN_OBSERVED_DAYS
  ) {
    const workoutDates = new Set(workouts.map((workout) => workout.date));
    const missingDates = observedDates.filter(
      (date) => !workoutDates.has(date),
    );
    if (
      missingDates.length >= MIN_OCCURRENCES &&
      missingDates.length / observedDates.length >= 0.5
    ) {
      drafts.push({
        type: "workout-not-logged",
        title: "Workouts are often not logged",
        explanation:
          "Several otherwise active logging days have no workout entry; this describes the logs, not effort or motivation.",
        suggestion:
          "Consider reviewing whether the existing workout timing fits those days.",
        evidence: evidence(
          missingDates.length,
          observedDates.length,
          WINDOW_DAYS,
          windowStart,
          input.referenceDate,
          ["repository.workouts", "settings.workout-goal"],
        ),
      });
    }
  }

  if (waterLogs && input.waterGoalMl > 0) {
    const totals = new Map<string, number>();
    for (const log of waterLogs) {
      totals.set(log.date, (totals.get(log.date) ?? 0) + log.amountMl);
    }
    const waterDates = [...totals.keys()];
    const lowWaterDates = waterDates.filter(
      (date) => (totals.get(date) ?? 0) < input.waterGoalMl * LOW_WATER_RATIO,
    );
    if (
      waterDates.length >= MIN_OBSERVED_DAYS &&
      lowWaterDates.length >= MIN_LOW_WATER_OCCURRENCES &&
      lowWaterDates.length / waterDates.length >= 0.5
    ) {
      const relevant = waterLogs.filter((log) =>
        lowWaterDates.includes(log.date),
      );
      drafts.push({
        type: "low-water",
        title: "Water often finishes below the existing target",
        explanation:
          "On several days with water entries, the logged total stayed below 60% of the target already stored in your settings.",
        suggestion:
          "Consider using the existing quick water log earlier in the day.",
        evidence: evidence(
          lowWaterDates.length,
          waterDates.length,
          WINDOW_DAYS,
          windowStart,
          input.referenceDate,
          relevant.map((log) => `water:${log.id}`),
        ),
      });
    }
  }

  if (input.disruptions) {
    const migraineDisruptions = input.disruptions.filter(
      (item) =>
        item.type === "migraine" &&
        inWindow(item.date, migraineWindowStart, input.referenceDate),
    );
    const observedDisruptionDays = unique(
      input.disruptions
        .filter((item) =>
          inWindow(item.date, migraineWindowStart, input.referenceDate),
        )
        .map((item) => item.date),
    ).length;
    if (migraineDisruptions.length >= MIN_OCCURRENCES) {
      drafts.push({
        type: "migraine-disruption",
        title: "Migraine-related plan changes were selected repeatedly",
        explanation:
          "You selected migraine as a planning disruption several times. This is a planning observation, not a diagnosis.",
        suggestion:
          "Consider using Plans changed? again when you want a gentler practical plan.",
        evidence: evidence(
          migraineDisruptions.length,
          observedDisruptionDays,
          MIGRAINE_WINDOW_DAYS,
          migraineWindowStart,
          input.referenceDate,
          migraineDisruptions.map(
            (item) => `active-disruption:${item.id}`,
          ),
        ),
      });
    }
  }

  return drafts
    .sort((left, right) => {
      const leftRatio = left.evidence.count / left.evidence.observedDays;
      const rightRatio = right.evidence.count / right.evidence.observedDays;
      return (
        rightRatio - leftRatio ||
        TYPE_ORDER.indexOf(left.type) - TYPE_ORDER.indexOf(right.type)
      );
    })
    .slice(0, MAX_INSIGHTS)
    .map(toInsight);
}
