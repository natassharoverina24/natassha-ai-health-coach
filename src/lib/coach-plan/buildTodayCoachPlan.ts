import {
  buildCoachDecision,
  buildPlannerUserContext,
} from "@/lib/ai/contextBuilder";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import {
  applyAdaptiveAdjustments,
  generateDailyPlan,
  generateEmergencyPlan,
  generateMealPlan,
  generateOfficeLunchPlan,
  generateWeeklyMealPrep,
  type DailyPlan,
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

const SCHEDULE_ORDER = [
  "breakfast",
  "lunch",
  "snack",
  "dinner",
  "workout",
  "waterReminder",
] as const;

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
        "Office lunch guidance will appear when today's remaining nutrition budget is available.",
      sourceIds: ["planner.office-lunch"],
    });
  } else if (dataAvailability.officeLunch === "invalid-input") {
    warnings.push({
      code: "office-lunch-invalid-input",
      message:
        "Office lunch guidance could not be prepared from the supplied budget, but the rest of today's plan is ready.",
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
        "Weekly meal prep needs reviewed planning data, while today's core plan remains available.",
      sourceIds: ["planner.weekly-meal-prep"],
    });
  }
  if (dataAvailability.emergencyAdjustment === "unavailable") {
    warnings.push({
      code: "emergency-disruption-unavailable",
      message:
        "No disruption was supplied, so today's regular plan remains in place.",
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
  return warnings;
}

function buildTraceSourceIds(
  prefix: string,
  decision: CoachDecision,
): string[] {
  return [prefix, ...decision.insights.map((insight) => insight.id)];
}

function buildTimeline(dailyPlan: DailyPlan) {
  return SCHEDULE_ORDER.map((kind) => ({
    kind,
    ...dailyPlan.schedule[kind],
    sourceIds: [`planner.daily.schedule.${kind}`],
  }));
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
  };
  const warnings = warningsFor(dataAvailability);

  return {
    generatedAt: decision.generatedAt,
    date: context.today,
    status: warnings.length === 0 ? "ready" : "partial",
    greeting: {
      value: "Today's coach plan is ready.",
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
    timeline: buildTimeline(dailyPlan),
    meals: buildMeals(decision, mealPlan),
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
