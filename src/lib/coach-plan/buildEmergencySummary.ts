import type { CoachDecision } from "@/lib/engines/decisionEngine";
import {
  generateEmergencyPlan,
  type EmergencyPlanResult,
  type MealSlot,
  type PlannerUserContext,
} from "@/lib/planner";
import type {
  ActiveDisruption,
  EmergencyDisruptionType,
  MealType,
} from "@/types/firestore";
import type {
  EmergencyAdjustmentSummary,
  TodayCoachTimelineItem,
} from "./types";

export interface EmergencySummaryBuildResult {
  summary: EmergencyAdjustmentSummary;
  timeline: TodayCoachTimelineItem[];
}

const NEXT_MEAL: Partial<Record<MealType, MealType>> = {
  breakfast: "lunch",
  lunch: "snack",
  snack: "dinner",
};

function relatedInsightIds(
  type: EmergencyDisruptionType,
  decision: CoachDecision,
): string[] {
  if (type === "migraine") {
    return decision.insights
      .filter(
        (insight) =>
          insight.engine === "migraine" || insight.id.startsWith("migraine."),
      )
      .map((insight) => insight.id);
  }
  if (type === "pms") {
    return decision.insights
      .filter(
        (insight) =>
          insight.engine === "menstrual" ||
          /pms|luteal|menstrual/i.test(insight.id),
      )
      .map((insight) => insight.id);
  }
  return [];
}

function compatiblePlannerResult(
  active: ActiveDisruption,
  decision: CoachDecision,
  context: PlannerUserContext,
): EmergencyPlanResult | null {
  if (active.type === "working-late" && active.expectedEndAt) {
    return generateEmergencyPlan(decision, context, {
      type: "overtime",
      expectedEndAt: active.expectedEndAt,
    });
  }
  if (
    active.type === "travelling" &&
    active.affectedSlot &&
    active.affectedSlot !== "workout"
  ) {
    return generateEmergencyPlan(decision, context, {
      type: "travel",
      affectedSlots: [active.affectedSlot],
    });
  }
  if (
    active.type === "skipped-meal" &&
    active.skippedMealSlot === "breakfast" &&
    active.skippedAt
  ) {
    return generateEmergencyPlan(decision, context, {
      type: "missed-breakfast",
      occurredAt: active.skippedAt,
    });
  }
  return null;
}

function plannerReplacement(
  result: EmergencyPlanResult | null,
  slot: MealSlot,
): string | null {
  if (result?.status !== "success") return null;
  const action = result.actions.find((candidate) => candidate.slot === slot);
  return action?.kind === "approved-template"
    ? action.recommendation.template.name
    : null;
}

function adjustmentKinds(active: ActiveDisruption): TodayCoachTimelineItem["kind"][] {
  if (active.type === "working-late") {
    return ["dinner", "workout", "sleepPreparation"];
  }
  if (active.type === "migraine") {
    return ["breakfast", "lunch", "snack", "dinner", "workout"];
  }
  if (active.type === "feeling-unwell") {
    return [
      "breakfast",
      "lunch",
      "snack",
      "dinner",
      "workout",
      "waterReminder",
      "sleepPreparation",
    ];
  }
  if (active.type === "pms") return ["snack"];
  if (active.type === "travelling" && active.affectedSlot) {
    return [active.affectedSlot];
  }
  if (active.type === "event-or-reception" && active.affectedMealSlot) {
    return [active.affectedMealSlot];
  }
  if (active.type === "missed-workout") return ["workout"];
  if (active.type === "skipped-meal" && active.skippedMealSlot) {
    const next = NEXT_MEAL[active.skippedMealSlot];
    return next
      ? [active.skippedMealSlot, next]
      : [active.skippedMealSlot];
  }
  return [];
}

function replacementFor(
  active: ActiveDisruption,
  kind: TodayCoachTimelineItem["kind"],
  plannerResult: EmergencyPlanResult | null,
  decision: CoachDecision,
): string {
  if (kind === "workout") {
    if (active.type === "missed-workout") {
      const supportsShorterWorkout = decision.insights.some(
        (insight) => insight.id === "adaptive.skipped_workout_day_pattern",
      );
      return supportsShorterWorkout
        ? "Use the existing shorter optional workout adjustment"
        : "Keep the workout optional today without penalty";
    }
    return "Optional gentle recovery movement";
  }
  if (kind === "waterReminder") return "Keep the existing hydration reminder";
  if (kind === "sleepPreparation") {
    return "Prioritize the existing sleep preparation";
  }
  const planned = plannerReplacement(
    plannerResult,
    kind as MealSlot,
  );
  if (planned) return planned;
  if (active.type === "pms") {
    return "Keep the planned snack and existing protein support";
  }
  if (active.type === "event-or-reception") {
    return "Use a flexible event meal with protein and hydration focus";
  }
  if (
    active.type === "skipped-meal" &&
    kind !== active.skippedMealSlot
  ) {
    return "Use the existing next meal as a gentle recovery meal";
  }
  return "Keep the existing meal simple and practical";
}

export function buildEmergencySummary({
  active,
  decision,
  context,
  timeline,
}: {
  active: ActiveDisruption;
  decision: CoachDecision;
  context: PlannerUserContext;
  timeline: readonly TodayCoachTimelineItem[];
}): EmergencySummaryBuildResult {
  const retainedIds = relatedInsightIds(active.type, decision);
  const declaredSource = `active-disruption:${active.id}`;
  const sourceIds = [
    declaredSource,
    "repository.active-disruptions",
    ...retainedIds,
  ];
  const plannerResult = compatiblePlannerResult(active, decision, context);
  const kinds = new Set(adjustmentKinds(active));
  const replacements = new Map<
    TodayCoachTimelineItem["kind"],
    string
  >();
  for (const kind of kinds) {
    replacements.set(
      kind,
      replacementFor(active, kind, plannerResult, decision),
    );
  }
  const adjustedTimeline = timeline.map((item) => {
    if (!kinds.has(item.kind)) return item;
    return {
      ...item,
      ...(active.type === "working-late" &&
      item.kind === "dinner" &&
      active.expectedEndAt
        ? { time: active.expectedEndAt }
        : {}),
      action: replacements.get(item.kind) ?? item.action,
      alternative: item.action,
      reason: "This practical change comes from today's active emergency mode.",
      status: "adjusted" as const,
      statusMessage: "No guilt. We adjusted this item gently for today.",
      manualCompletionAllowed: false,
      sourceIds: [...item.sourceIds, ...sourceIds],
    };
  });
  const changedItems = adjustedTimeline.filter(
    (item, index) => item !== timeline[index],
  );
  const hasRetainedConditionInsight =
    (active.type === "migraine" || active.type === "pms") &&
    retainedIds.length > 0;
  const message = hasRetainedConditionInsight
    ? "No guilt. We adjusted today's plan using the retained guidance."
    : "We'll adjust the plan gently based on what you selected.";

  return {
    summary: {
      type: active.type,
      message,
      changedTimelineItemIds: changedItems.map((item) => item.id),
      preservedTargets: [
        "calories",
        "protein",
        "water",
        "workout",
        "sleep",
      ],
      removedActions: changedItems.map(
        (changed) =>
          timeline.find((item) => item.id === changed.id)?.action ?? "",
      ),
      replacementActions: changedItems.map((item) => item.action),
      sourceIds,
    },
    timeline: adjustedTimeline,
  };
}
