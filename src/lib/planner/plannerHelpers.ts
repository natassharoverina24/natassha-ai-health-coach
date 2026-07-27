/**
 * Planning Layer — Helpers
 * ---------------------------------------------------------------------------
 * Pure utility functions used by the daily planner. No framework imports,
 * no Firestore, no side effects.
 */
import type { EngineInsight } from "@/lib/engines/types";
import type { InsightSummary, ScheduleSlot } from "./plannerTypes";

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** "HH:mm" → minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Minutes since midnight → "HH:mm". */
export function toHHmm(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function makeSlot(label: string, time: string): ScheduleSlot {
  return { label, time };
}

// ---------------------------------------------------------------------------
// Schedule placement
// ---------------------------------------------------------------------------

/**
 * Places meal, workout, and water-reminder times realistically around the
 * confirmed commute window (AI_PLANNING_SPEC.md §2.2).
 *
 * Design decisions:
 *  - Breakfast: 30 min before leaving — the confirmed morning window is
 *    narrow (~05:00 wake, ~06:30 leave), so this is a quick meal slot.
 *  - Lunch: midday, anchored at 12:00 — the office provides lunch on
 *    workdays, so time is predictable.
 *  - Snack: mid-afternoon (15:00) — keeps meal gaps under the 5-hour
 *    migraine-safe threshold (AI_COACH_SPEC.md §6.2).
 *  - Dinner: 60 min after arriving home — a reasonable default until a
 *    confirmed dinner time exists (USER_PROFILE.md §3 marks dinner as
 *    "not yet confirmed").
 *  - Workout: 90 min after arriving home — placed in the Workday Engine's
 *    "evening window," after dinner prep time.
 *  - Water reminder: early afternoon (13:00) — a single midday nudge as
 *    a default pacing point for hydration.
 */
export function buildSchedule(leaveHomeTime: string, arriveHomeTime: string) {
  const leaveMin = toMinutes(leaveHomeTime);
  const arriveMin = toMinutes(arriveHomeTime);

  return {
    breakfast: makeSlot("Breakfast", toHHmm(leaveMin - 30)),
    lunch: makeSlot("Lunch", "12:00"),
    snack: makeSlot("Snack", "15:00"),
    dinner: makeSlot("Dinner", toHHmm(arriveMin + 60)),
    workout: makeSlot("Workout", toHHmm(arriveMin + 90)),
    waterReminder: makeSlot("Water reminder", "13:00"),
  };
}

// ---------------------------------------------------------------------------
// Insight extraction (AI_PLANNING_SPEC.md §2.3, §2.4)
// ---------------------------------------------------------------------------

function toInsightSummary(insight: EngineInsight): InsightSummary {
  return {
    id: insight.id,
    summary: insight.summary,
    recommendedAction: insight.recommendedAction,
  };
}

/**
 * Extracts the daily summary fields from an already-ranked insight list.
 * This is the same split the Dashboard's AICoachCard already performs
 * (Phase 5), now formalized as a pure function in the Planning Layer so
 * any future surface can reuse it without importing a React component.
 *
 * No priority, urgency, or tone is computed here — every value read was
 * already decided by the engines and the Decision Engine.
 */
export function extractSummary(insights: EngineInsight[], whyMotivationText: string | null) {
  const topInsight = insights[0] ?? null;

  const topPriority = topInsight ? toInsightSummary(topInsight) : null;

  // Biggest risk = the top-ranked insight, UNLESS it's celebratory.
  // A celebratory top insight means nothing more urgent fired today — a
  // good day, not a risk day.
  const biggestRisk =
    topInsight && topInsight.tone !== "celebratory" ? toInsightSummary(topInsight) : null;

  // Today's win = the highest-ranked insight tagged "celebratory."
  const winInsight = insights.find((i) => i.tone === "celebratory") ?? null;
  const todaysWin = winInsight ? toInsightSummary(winInsight) : null;

  // Encouragement = the WHY Engine's surfaced motivation text, or null.
  // The WHY Engine already handles cooldown and rotation; the planner
  // just reads whatever it decided.
  const encouragement = whyMotivationText;

  return { topPriority, biggestRisk, todaysWin, encouragement };
}

/**
 * Finds the WHY Engine's motivation text from the CoachDecision, if it
 * fired today. Returns null when the WHY Engine stayed silent (cooldown
 * or no motivations stored), matching AI_PLANNING_SPEC.md §2.4's rule
 * that the plan carries no encouragement line rather than fabricating one.
 */
export function findWhyMotivationText(insights: EngineInsight[]): string | null {
  const whyInsight = insights.find((i) => i.id === "why.surface_motivation");
  if (!whyInsight?.data) return null;
  const text = whyInsight.data["motivationText"];
  return typeof text === "string" ? text : null;
}
