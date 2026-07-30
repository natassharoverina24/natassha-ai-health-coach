import type { DailyPlan, MealSlot } from "@/lib/planner";
import type {
  TodayCoachMeals,
  TodayCoachTimelineCompletionSource,
  TodayCoachTimelineImpact,
  TodayCoachTimelineItem,
  TodayCoachTimelineStatus,
} from "./types";

const SCHEDULE_ORDER = [
  "breakfast",
  "lunch",
  "snack",
  "dinner",
  "workout",
  "waterReminder",
] as const;

type ScheduledKind = (typeof SCHEDULE_ORDER)[number];

export interface TimelineLogReference {
  id: string;
}

export interface TimelineMealLogReference extends TimelineLogReference {
  type: MealSlot;
}

export interface TimelineManualCompletionReference
  extends TimelineLogReference {
  itemId: string;
}

export interface TimelineReconciliationEvidence {
  mealLogs: readonly TimelineMealLogReference[] | null;
  waterLogs: readonly TimelineLogReference[] | null;
  workoutLogs: readonly TimelineLogReference[] | null;
  manualCompletions: readonly TimelineManualCompletionReference[] | null;
}

export interface ReconcileTimelineStatusInput {
  date: string;
  currentDate: string;
  dailyPlan: DailyPlan;
  meals: TodayCoachMeals;
  evidence: TimelineReconciliationEvidence;
}

function completionSourceFor(
  kind: ScheduledKind,
): TodayCoachTimelineCompletionSource {
  if (
    kind === "breakfast" ||
    kind === "lunch" ||
    kind === "snack" ||
    kind === "dinner"
  ) {
    return "meal-log";
  }
  return kind === "workout" ? "workout-log" : "water-log";
}

function matchingEvidence(
  itemId: string,
  kind: ScheduledKind,
  source: TodayCoachTimelineCompletionSource,
  evidence: TimelineReconciliationEvidence,
): readonly TimelineLogReference[] | null {
  if (source === "meal-log") {
    return evidence.mealLogs?.filter((entry) => entry.type === kind) ?? null;
  }
  if (source === "water-log") return evidence.waterLogs;
  if (source === "workout-log") return evidence.workoutLogs;
  return (
    evidence.manualCompletions?.filter((entry) => entry.itemId === itemId) ??
    null
  );
}

function statusFor(
  date: string,
  currentDate: string,
  matches: readonly TimelineLogReference[] | null,
): TodayCoachTimelineStatus {
  if (matches && matches.length > 0) return "completed";
  if (matches === null) return "pending";
  return date < currentDate ? "missed" : "pending";
}

function statusMessage(status: TodayCoachTimelineStatus): string {
  if (status === "completed") return "Completed from the recorded activity.";
  if (status === "missed") {
    return "No completion was recorded before the day ended; the next plan remains available.";
  }
  if (status === "adjusted") return "This item uses an approved adjusted time.";
  return "Still open for today.";
}

function mealImpacts(
  slot: MealSlot,
  dailyPlan: DailyPlan,
  meals: TodayCoachMeals,
): TodayCoachTimelineImpact[] {
  const meal = meals[slot];
  return [
    {
      metric: "calories",
      plannedValue: meal.nutrition.caloriesKcal,
      dailyTarget: dailyPlan.targets.calories,
      unit: "kcal",
      sourceIds: [...meal.sourceIds, "planner.daily.targets"],
    },
    {
      metric: "proteinG",
      plannedValue: meal.nutrition.proteinG,
      dailyTarget: dailyPlan.targets.proteinG,
      unit: "g",
      sourceIds: [...meal.sourceIds, "planner.daily.targets"],
    },
  ];
}

function impactsFor(
  kind: ScheduledKind,
  dailyPlan: DailyPlan,
  meals: TodayCoachMeals,
): TodayCoachTimelineImpact[] {
  if (
    kind === "breakfast" ||
    kind === "lunch" ||
    kind === "snack" ||
    kind === "dinner"
  ) {
    return mealImpacts(kind, dailyPlan, meals);
  }
  if (kind === "workout") {
    return [
      {
        metric: "workoutMin",
        plannedValue: dailyPlan.targets.workoutMin,
        dailyTarget: dailyPlan.targets.workoutMin,
        unit: "min",
        sourceIds: ["planner.daily.targets"],
      },
    ];
  }
  return [
    {
      metric: "waterMl",
      plannedValue: null,
      dailyTarget: dailyPlan.targets.waterMl,
      unit: "ml",
      sourceIds: ["planner.daily.targets"],
    },
  ];
}

function actionAndReason(
  kind: ScheduledKind,
  dailyPlan: DailyPlan,
  meals: TodayCoachMeals,
): { action: string; reason: string; sourceIds: string[] } {
  if (
    kind === "breakfast" ||
    kind === "lunch" ||
    kind === "snack" ||
    kind === "dinner"
  ) {
    const meal = meals[kind];
    return {
      action: meal.recommendation.name,
      reason: meal.why[0],
      sourceIds: [...meal.sourceIds],
    };
  }
  return {
    action: dailyPlan.schedule[kind].label,
    reason: "Scheduled by the existing Daily Planner.",
    sourceIds: [`planner.daily.schedule.${kind}`],
  };
}

export function reconcileTimelineStatus({
  date,
  currentDate,
  dailyPlan,
  meals,
  evidence,
}: ReconcileTimelineStatusInput): TodayCoachTimelineItem[] {
  return SCHEDULE_ORDER.map((kind) => {
    const id = `${date}:${kind}`;
    const completionSource = completionSourceFor(kind);
    const matches = matchingEvidence(id, kind, completionSource, evidence);
    const status = statusFor(date, currentDate, matches);
    const content = actionAndReason(kind, dailyPlan, meals);

    return {
      id,
      date,
      kind,
      ...dailyPlan.schedule[kind],
      action: content.action,
      reason: content.reason,
      alternative: null,
      impact: impactsFor(kind, dailyPlan, meals),
      status,
      statusMessage: statusMessage(status),
      completionSource,
      manualCompletionAllowed: completionSource === "manual",
      sourceIds: [
        ...content.sourceIds,
        `repository.${completionSource}`,
        ...(matches ?? []).map((entry) => `${completionSource}:${entry.id}`),
      ],
    };
  });
}
