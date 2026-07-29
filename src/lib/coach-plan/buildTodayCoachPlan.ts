import {
  buildCoachDecision,
  buildPlannerUserContext,
} from "@/lib/ai/contextBuilder";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import { mealsRepository } from "@/lib/db/meals.repository";
import { timelineCompletionsRepository } from "@/lib/db/timelineCompletions.repository";
import { waterLogsRepository } from "@/lib/db/waterLogs.repository";
import { workoutsRepository } from "@/lib/db/workouts.repository";
import {
  applyAdaptiveAdjustments,
  generateDailyPlan,
  generateEmergencyPlan,
  generateMealPlan,
  generateOfficeLunchPlan,
  generateWeeklyMealPrep,
  type InsightSummary,
  type MealPlan,
  type MealSlot,
} from "@/lib/planner";
import {
  TODAY_COACH_MEAL_SLOTS,
  type CoachPlanAvailabilityStatus,
  type TodayCoachDataAvailability,
  type TodayCoachMealGuidance,
  type TodayCoachMeals,
  type TodayCoachPlan,
  type TodayCoachPlanOptions,
  type TodayCoachPlanWarning,
  type TraceableValue,
} from "./types";
import { reconcileTimelineStatus } from "./reconcileTimelineStatus";

const MEAL_RELEVANT_INSIGHT_IDS = new Set([
  "migraine.active_symptom_care",
  "menstrual.pms_hunger_support",
  "nutrition.protein_first",
]);

function tracedInsight(
  value: InsightSummary | null,
): TraceableValue<InsightSummary> | null {
  return value ? { value, sourceIds: [value.id] } : null;
}

function retainedMealSourceIds(decision: CoachDecision, slot: MealSlot): string[] {
  return [
    `planner.meal.${slot}`,
    ...decision.insights
      .map((insight) => insight.id)
      .filter((id) => MEAL_RELEVANT_INSIGHT_IDS.has(id)),
  ];
}

function buildMeals(
  decision: CoachDecision,
  mealPlan: MealPlan,
): TodayCoachMeals {
  return Object.fromEntries(
    TODAY_COACH_MEAL_SLOTS.map((slot) => [
      slot,
      {
        ...mealPlan[slot],
        sourceIds: retainedMealSourceIds(decision, slot),
      } satisfies TodayCoachMealGuidance,
    ]),
  ) as unknown as TodayCoachMeals;
}

function availabilityFromResult(
  result:
    | { status: "success" | "not-applicable" | "invalid-input" }
    | null,
): CoachPlanAvailabilityStatus {
  if (!result) return "unavailable";
  return result.status === "success" ? "available" : result.status;
}

function officeAvailability(
  officeLunch: ReturnType<typeof generateOfficeLunchPlan> | null,
): CoachPlanAvailabilityStatus {
  if (!officeLunch) return "unavailable";
  return officeLunch.applicable ? "available" : "not-applicable";
}

function warningsFor(
  dataAvailability: TodayCoachDataAvailability,
): TodayCoachPlanWarning[] {
  const warnings: TodayCoachPlanWarning[] = [];
  if (dataAvailability.officeLunch === "unavailable") {
    warnings.push({
      code: "office-lunch-budget-unavailable",
      message:
        "Office lunch guidance will appear when today’s remaining nutrition budget is available.",
      sourceIds: ["planner.office-lunch"],
    });
  } else if (dataAvailability.officeLunch === "invalid-input") {
    warnings.push({
      code: "office-lunch-invalid-input",
      message:
        "Office lunch guidance could not be prepared from the supplied budget, but the rest of today’s plan is ready.",
      sourceIds: ["planner.office-lunch"],
    });
  }
  if (dataAvailability.weeklyContext === "unavailable") {
    warnings.push({
      code: "weekly-planning-input-unavailable",
      message:
        "Weekly meal prep will appear when approved ingredient and office-lunch planning data is available.",
      sourceIds: ["planner.weekly-meal-prep"],
    });
  } else if (dataAvailability.weeklyContext === "invalid-input") {
    warnings.push({
      code: "weekly-planning-invalid-input",
      message:
        "Weekly meal prep needs reviewed planning data, while today’s core plan remains available.",
      sourceIds: ["planner.weekly-meal-prep"],
    });
  }
  if (dataAvailability.emergencyAdjustment === "unavailable") {
    warnings.push({
      code: "emergency-disruption-unavailable",
      message:
        "No disruption was supplied, so today’s regular plan remains in place.",
      sourceIds: ["planner.emergency"],
    });
  } else if (dataAvailability.emergencyAdjustment === "invalid-input") {
    warnings.push({
      code: "emergency-adjustment-invalid-input",
      message:
        "The disruption details need review before an emergency adjustment can be shown.",
      sourceIds: ["planner.emergency"],
    });
  }
  if (dataAvailability.adaptiveAdjustments === "invalid-input") {
    warnings.push({
      code: "adaptive-adjustment-invalid-input",
      message:
        "Adaptive adjustments need reviewed plan data; no automatic change was applied.",
      sourceIds: ["planner.adaptive-adjustments"],
    });
  }
  if (dataAvailability.timelineStatus.mealLogs === "unavailable") {
    warnings.push({
      code: "timeline-meal-logs-unavailable",
      message:
        "Meal activity could not be checked, so meal timeline items remain open without blocking today's plan.",
      sourceIds: ["repository.meal-log"],
    });
  }
  if (dataAvailability.timelineStatus.waterLogs === "unavailable") {
    warnings.push({
      code: "timeline-water-logs-unavailable",
      message:
        "Water activity could not be checked, so hydration remains open without blocking today's plan.",
      sourceIds: ["repository.water-log"],
    });
  }
  if (dataAvailability.timelineStatus.workoutLogs === "unavailable") {
    warnings.push({
      code: "timeline-workout-logs-unavailable",
      message:
        "Workout activity could not be checked, so the workout remains open without blocking today's plan.",
      sourceIds: ["repository.workout-log"],
    });
  }
  if (dataAvailability.timelineStatus.manualCompletions === "unavailable") {
    warnings.push({
      code: "timeline-manual-completions-unavailable",
      message:
        "Manual timeline check-ins could not be loaded, while the rest of today's plan remains available.",
      sourceIds: ["repository.manual"],
    });
  }
  return warnings;
}

function buildTraceSourceIds(
  prefix: string,
  decision: CoachDecision,
): string[] {
  return [prefix, ...decision.insights.map((insight) => insight.id)];
}

function fulfilledValue<T>(
  result: PromiseSettledResult<T>,
): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

/**
 * Composes existing Decision Engine and Planning Layer outputs into one
 * traceable read model. It does not add, rank, suppress, or rewrite coaching
 * decisions.
 */
export async function buildTodayCoachPlan(
  userId: string,
  options: TodayCoachPlanOptions = {},
): Promise<TodayCoachPlan> {
  const [decision, context] = await Promise.all([
    buildCoachDecision(userId),
    buildPlannerUserContext(userId),
  ]);
  const dailyPlan = generateDailyPlan(decision, context);
  const mealPlan = generateMealPlan(decision, context);
  const meals = buildMeals(decision, mealPlan);

  const [
    mealLogsResult,
    waterLogsResult,
    workoutLogsResult,
    manualCompletionsResult,
  ] = await Promise.allSettled([
    mealsRepository.listForUserByDate(userId, context.today),
    waterLogsRepository.listForUserByDate(userId, context.today),
    workoutsRepository.listForUserByDate(userId, context.today),
    timelineCompletionsRepository.listForUserByDate(userId, context.today),
  ]);
  const mealLogs = fulfilledValue(mealLogsResult);
  const waterLogs = fulfilledValue(waterLogsResult);
  const workoutLogs = fulfilledValue(workoutLogsResult);
  const manualCompletions = fulfilledValue(manualCompletionsResult);
  const timeline = reconcileTimelineStatus({
    date: context.today,
    currentDate: context.today,
    dailyPlan,
    meals,
    evidence: {
      mealLogs,
      waterLogs,
      workoutLogs,
      manualCompletions,
    },
  });

  let officeLunch: ReturnType<typeof generateOfficeLunchPlan> | null = null;
  let officeLunchAvailability: CoachPlanAvailabilityStatus = "unavailable";
  if (options.remainingNutritionBudget) {
    try {
      officeLunch = generateOfficeLunchPlan(
        decision,
        context,
        options.remainingNutritionBudget,
      );
      officeLunchAvailability = officeAvailability(officeLunch);
    } catch {
      officeLunchAvailability = "invalid-input";
    }
  }
  const weeklyContext =
    options.officeLunchByDate && options.ingredientCatalogue
      ? generateWeeklyMealPrep({
          decision,
          context,
          officeLunchByDate: options.officeLunchByDate,
          ingredientCatalogue: options.ingredientCatalogue,
        })
      : null;
  const emergencyAdjustment = options.emergencyDisruption
    ? generateEmergencyPlan(decision, context, options.emergencyDisruption)
    : null;
  const adaptiveAdjustments = applyAdaptiveAdjustments({
    plan: {
      date: context.today,
      dailyPlan,
      mealPlan,
    },
    decision,
  });

  const dataAvailability: TodayCoachDataAvailability = {
    decision: "available",
    dailyPlan: "available",
    mealPlan: "available",
    officeLunch: officeLunchAvailability,
    emergencyAdjustment: availabilityFromResult(emergencyAdjustment),
    adaptiveAdjustments: availabilityFromResult(adaptiveAdjustments),
    weeklyContext: availabilityFromResult(weeklyContext),
    timelineStatus: {
      mealLogs: mealLogs === null ? "unavailable" : "available",
      waterLogs: waterLogs === null ? "unavailable" : "available",
      workoutLogs: workoutLogs === null ? "unavailable" : "available",
      manualCompletions:
        manualCompletions === null ? "unavailable" : "available",
    },
  };
  const warnings = warningsFor(dataAvailability);

  return {
    generatedAt: decision.generatedAt,
    date: context.today,
    status: warnings.length === 0 ? "ready" : "partial",
    greeting: {
      value: "Today’s coach plan is ready.",
      sourceIds: ["coach-plan.static-greeting"],
    },
    briefing: {
      retainedInsights: decision.insights.map((insight) => ({ ...insight })),
      encouragement: dailyPlan.summary.encouragement
        ? {
            value: dailyPlan.summary.encouragement,
            sourceIds: decision.insights
              .filter((insight) => insight.engine === "why")
              .map((insight) => insight.id),
          }
        : null,
      sourceIds: decision.insights.map((insight) => insight.id),
    },
    focus: tracedInsight(dailyPlan.summary.topPriority),
    biggestRisk: tracedInsight(dailyPlan.summary.biggestRisk),
    todaysWin: tracedInsight(dailyPlan.summary.todaysWin),
    timeline,
    meals,
    metrics: {
      value: { ...dailyPlan.targets },
      sourceIds: ["planner.daily.targets", "planner-context"],
    },
    officeLunch: officeLunch
      ? {
          value: officeLunch,
          sourceIds: buildTraceSourceIds("planner.office-lunch", decision),
        }
      : null,
    emergencyAdjustment: emergencyAdjustment
      ? {
          value: emergencyAdjustment,
          sourceIds: buildTraceSourceIds("planner.emergency", decision),
        }
      : null,
    adaptiveAdjustments: {
      value: adaptiveAdjustments,
      sourceIds:
        adaptiveAdjustments.status === "success"
          ? [
              "planner.adaptive-adjustments",
              ...adaptiveAdjustments.adjustments.map(
                (adjustment) => adjustment.reasonInsightId,
              ),
            ]
          : ["planner.adaptive-adjustments"],
    },
    weeklyContext: weeklyContext
      ? {
          value: weeklyContext,
          sourceIds: buildTraceSourceIds("planner.weekly-meal-prep", decision),
        }
      : null,
    dataAvailability,
    warnings,
  };
}
