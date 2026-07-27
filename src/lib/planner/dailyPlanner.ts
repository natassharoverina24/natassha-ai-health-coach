/**
 * Planning Layer — Daily Planner
 * ---------------------------------------------------------------------------
 * Implements AI_PLANNING_SPEC.md §2 exactly: consumes a CoachDecision and
 * a validated PlannerUserContext (both supplied, never self-fetched) and
 * returns one structured DailyPlan.
 *
 * This file is a pure function. It has no React imports, no Firestore
 * access, no API calls, no side effects. Every value in the output is
 * either read directly from the inputs (targets, schedule) or extracted
 * from already-decided engine insights (summary). Nothing is computed
 * fresh — the Planning Layer operationalizes, it never decides.
 */
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type { DailyPlan, PlannerUserContext } from "./plannerTypes";
import { buildSchedule, extractSummary, findWhyMotivationText } from "./plannerHelpers";

/**
 * Generates one Daily Plan for today.
 *
 * @param decision  The already-ranked CoachDecision from the Decision Engine.
 * @param context   The validated user context already assembled by the
 *                  application's context builder. The planner never
 *                  fetches this itself.
 */
export function generateDailyPlan(
  decision: CoachDecision,
  context: PlannerUserContext,
): DailyPlan {
  const targets = {
    calories: context.calorieGoal,
    proteinG: context.proteinGoalG,
    waterMl: context.waterGoalMl,
    workoutMin: context.workoutGoalMinPerDay,
    steps: context.stepsGoal,
    sleepHours: context.sleepGoalHours,
  };

  const schedule = buildSchedule(context.leaveHomeTime, context.arriveHomeTime);

  const whyMotivationText = findWhyMotivationText(decision.insights);
  const summary = extractSummary(decision.insights, whyMotivationText);

  return {
    targets,
    schedule,
    summary,
    generatedAt: decision.generatedAt,
  };
}
