import {
  buildCoachDecisionWithAvailability,
  buildPlannerUserContext,
} from "@/lib/ai/contextBuilder";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import { mealsRepository } from "@/lib/db/meals.repository";
import { timelineCompletionsRepository } from "@/lib/db/timelineCompletions.repository";
import { waterLogsRepository } from "@/lib/db/waterLogs.repository";
import { workoutsRepository } from "@/lib/db/workouts.repository";
import { waistsRepository } from "@/lib/db/waists.repository";
import { activeDisruptionsRepository } from "@/lib/db/activeDisruptions.repository";
import { where } from "firebase/firestore";
import { buildAdaptiveInsights } from "@/lib/adaptive-learning";
import {
  applyAdaptiveAdjustments,
  generateDailyPlan,
  generateMealPlan,
  generateOfficeLunchPlan,
  generateWeeklyMealPrep,
  type InsightSummary,
} from "@/lib/planner";
import {
  type CoachPlanAvailabilityStatus,
  type TodayCoachDataAvailability,
  type TodayCoachPlan,
  type TodayCoachPlanOptions,
  type TodayCoachPlanWarning,
  type TraceableValue,
} from "./types";
import { reconcileTimelineStatus } from "./reconcileTimelineStatus";
import {
  loadDataSource,
  sourceAvailability,
  type DataSourceAvailability,
} from "./availability";
import { buildMealGuidance } from "./buildMealGuidance";
import { buildMetricSummary } from "./buildMetricSummary";
import { buildEmergencySummary } from "./buildEmergencySummary";

function tracedInsight(
  value: InsightSummary | null,
): TraceableValue<InsightSummary> | null {
  return value ? { value, sourceIds: [value.id] } : null;
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
        "Today's emergency-mode status could not be checked, so the regular plan remains visible.",
      sourceIds: ["repository.active-disruptions"],
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
  const optionalSources: Array<
    [
      string,
      DataSourceAvailability,
    ]
  > = [
    ["weights", dataAvailability.sources.weights],
    ["waists", dataAvailability.sources.waists],
    ["meals", dataAvailability.sources.meals],
    ["water", dataAvailability.sources.water],
    ["workouts", dataAvailability.sources.workouts],
    ["sleep", dataAvailability.sources.sleep],
    ["cycles", dataAvailability.sources.cycles],
    ["motivations", dataAvailability.sources.motivations],
    ["adaptive learning history", dataAvailability.sources.adaptiveLearningHistory],
  ];
  for (const [source, availability] of optionalSources) {
    if (
      availability.status === "unavailable" ||
      availability.status === "stale"
    ) {
      warnings.push({
        code: "optional-source-unavailable",
        message: `${source[0].toUpperCase()}${source.slice(1)} data could not be refreshed, so related coaching was safely omitted.`,
        sourceIds: [`repository.${source}`],
      });
    }
  }
  return warnings;
}

function buildTraceSourceIds(
  prefix: string,
  decision: CoachDecision,
): string[] {
  return [prefix, ...decision.insights.map((insight) => insight.id)];
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
  const [decisionResult, context] = await Promise.all([
    buildCoachDecisionWithAvailability(userId),
    buildPlannerUserContext(userId),
  ]);
  const { decision, sources } = decisionResult;
  const dailyPlan = generateDailyPlan(decision, context);
  const mealPlan = generateMealPlan(decision, context);

  const [
    mealLogsResult,
    waterLogsResult,
    workoutLogsResult,
    manualCompletionsResult,
    waistsResult,
    activeDisruptionResult,
    adaptiveDisruptionsResult,
  ] =
    await Promise.all([
      loadDataSource(
        () => mealsRepository.listForUserByDate(userId, context.today),
        [],
        { isEmpty: (items) => items.length === 0 },
      ),
      loadDataSource(
        () => waterLogsRepository.listForUserByDate(userId, context.today),
        [],
        { isEmpty: (items) => items.length === 0 },
      ),
      loadDataSource(
        () => workoutsRepository.listForUserByDate(userId, context.today),
        [],
        { isEmpty: (items) => items.length === 0 },
      ),
      loadDataSource(
        () =>
          timelineCompletionsRepository.listForUserByDate(
            userId,
            context.today,
          ),
        [],
        { isEmpty: (items) => items.length === 0 },
      ),
      loadDataSource(() => waistsRepository.listForUser(userId, 90), [], {
        isEmpty: (items) => items.length === 0,
      }),
      options.activeDisruption !== undefined
        ? Promise.resolve({
            status: options.activeDisruption ? "available" as const : "empty" as const,
            data: options.activeDisruption,
          })
        : loadDataSource(
            () =>
              activeDisruptionsRepository.getActiveForUserByDate(
                userId,
                context.today,
              ),
            null,
            { isEmpty: (item) => item === null },
          ),
      options.adaptiveDisruptionHistory !== undefined
        ? Promise.resolve({
            status: options.adaptiveDisruptionHistory.length
              ? "available" as const
              : "empty" as const,
            data: [...options.adaptiveDisruptionHistory],
          })
        : loadDataSource(
            () =>
              activeDisruptionsRepository.list([
                where("userId", "==", userId),
              ]),
            [],
            { isEmpty: (items) => items.length === 0 },
          ),
    ]);
  const mealLogs =
    mealLogsResult.status === "unavailable" ? null : mealLogsResult.data;
  const waterLogs =
    waterLogsResult.status === "unavailable" ? null : waterLogsResult.data;
  const workoutLogs =
    workoutLogsResult.status === "unavailable" ? null : workoutLogsResult.data;
  const manualCompletions =
    manualCompletionsResult.status === "unavailable"
      ? null
      : manualCompletionsResult.data;
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
  const meals = buildMealGuidance({
    decision,
    context,
    dailyPlan,
    mealPlan,
    mealLogs,
    officeLunchPlan: officeLunch,
  });
  let timeline = reconcileTimelineStatus({
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
  const weeklyContext =
    options.officeLunchByDate && options.ingredientCatalogue
      ? generateWeeklyMealPrep({
          decision,
          context,
          officeLunchByDate: options.officeLunchByDate,
          ingredientCatalogue: options.ingredientCatalogue,
        })
      : null;
  const activeDisruption =
    activeDisruptionResult.status === "unavailable"
      ? null
      : activeDisruptionResult.data;
  const emergencyBuild = activeDisruption
    ? buildEmergencySummary({
        active: activeDisruption,
        decision,
        context,
        timeline,
      })
    : null;
  if (emergencyBuild) timeline = emergencyBuild.timeline;
  const emergencyAdjustment = emergencyBuild?.summary ?? null;
  const adaptiveAdjustments = applyAdaptiveAdjustments({
    plan: {
      date: context.today,
      dailyPlan,
      mealPlan,
    },
    decision,
  });
  const adaptiveInsights = buildAdaptiveInsights({
    referenceDate: context.today,
    proteinGoalG: context.proteinGoalG,
    waterGoalMl: context.waterGoalMl,
    workoutGoalMinPerDay: context.workoutGoalMinPerDay,
    meals: sources.meals.status === "unavailable" ? null : sources.meals.data,
    waterLogs:
      sources.water.status === "unavailable" ? null : sources.water.data,
    workouts:
      sources.workouts.status === "unavailable" ? null : sources.workouts.data,
    disruptions:
      adaptiveDisruptionsResult.status === "unavailable"
        ? null
        : adaptiveDisruptionsResult.data,
  });

  const dataAvailability: TodayCoachDataAvailability = {
    decision: "available",
    dailyPlan: "available",
    mealPlan: "available",
    officeLunch: officeLunchAvailability,
    emergencyAdjustment:
      activeDisruptionResult.status === "unavailable"
        ? "unavailable"
        : emergencyAdjustment
          ? "available"
          : "not-applicable",
    adaptiveAdjustments: availabilityFromResult(adaptiveAdjustments),
    weeklyContext: availabilityFromResult(weeklyContext),
    timelineStatus: {
      mealLogs: mealLogsResult.status,
      waterLogs: waterLogsResult.status,
      workoutLogs: workoutLogsResult.status,
      manualCompletions: manualCompletionsResult.status,
    },
    sources: {
      profile: sourceAvailability(sources.profile),
      settings: sourceAvailability(sources.settings),
      currentDateTime: sourceAvailability(sources.currentDateTime),
      weights: sourceAvailability(sources.weights),
      waists: sourceAvailability(waistsResult),
      meals: sourceAvailability(sources.meals),
      water: sourceAvailability(sources.water),
      workouts: sourceAvailability(sources.workouts),
      sleep: sourceAvailability(sources.sleep),
      cycles: sourceAvailability(sources.cycles),
      motivations: sourceAvailability(sources.motivations),
      timelineCompletions: sourceAvailability(manualCompletionsResult),
      activeDisruption: sourceAvailability(activeDisruptionResult),
      adaptiveLearningHistory: sourceAvailability(adaptiveDisruptionsResult),
    },
    cache: { status: "empty" },
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
    metrics: buildMetricSummary({
      today: context.today,
      targets: dailyPlan.targets,
      profile: sources.profile,
      weights: sources.weights,
      waists: waistsResult,
      meals: sources.meals,
      water: sources.water,
      workouts: sources.workouts,
      sleep: sources.sleep,
    }),
    officeLunch: officeLunch
      ? {
          value: officeLunch,
          sourceIds: buildTraceSourceIds("planner.office-lunch", decision),
        }
      : null,
    emergencyAdjustment: emergencyAdjustment
      ? {
          value: emergencyAdjustment,
          sourceIds: [...emergencyAdjustment.sourceIds],
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
    adaptiveInsights,
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
