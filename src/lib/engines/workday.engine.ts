/**
 * Workday Engine
 * ---------------------------------------------------------------------------
 * Uses the commute window already on the user's profile (leaveHomeTime /
 * arriveHomeTime / lunchProvidedByOffice) to time suggestions for the part
 * of the day that's actually actionable — no point suggesting meal prep
 * during a commute, or an evening workout before the person has left for
 * work.
 */
import type { EngineInsight } from "./types";

export interface WorkdayEngineInput {
  leaveHomeTime: string; // "HH:mm"
  arriveHomeTime: string; // "HH:mm"
  lunchProvidedByOffice: boolean;
  currentHour: number;
  currentMinute: number;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function runWorkdayEngine(input: WorkdayEngineInput): EngineInsight[] {
  const { leaveHomeTime, arriveHomeTime, lunchProvidedByOffice, currentHour, currentMinute } = input;
  const nowMin = currentHour * 60 + currentMinute;
  const leaveMin = toMinutes(leaveHomeTime);
  const arriveMin = toMinutes(arriveHomeTime);

  const insights: EngineInsight[] = [];

  // --- morning window: before leaving for work ---
  if (nowMin < leaveMin && leaveMin - nowMin <= 90) {
    insights.push({
      id: "workday.morning_window",
      engine: "workday",
      priority: "low",
      urgency: "soon",
      tone: "encouraging",
      summary: `About ${leaveMin - nowMin} minutes before today's commute starts.`,
      reason: "Mornings before leaving are the narrowest window of the day — worth suggesting something quick rather than a full routine.",
      recommendedAction: "A quick breakfast and a glass of water now sets up the rest of the day, even if it's brief.",
      data: { minutesUntilLeave: leaveMin - nowMin },
    });
  }

  // --- workday window: at work, office lunch context ---
  if (nowMin >= leaveMin && nowMin < arriveMin) {
    if (lunchProvidedByOffice) {
      insights.push({
        id: "workday.office_hours_lunch_context",
        engine: "workday",
        priority: "low",
        urgency: "none",
        tone: "neutral",
        summary: "Currently in office hours, with lunch provided by the office.",
        reason: "There's no meal-prep decision to make during work hours today — the only action needed is logging what's eaten.",
        recommendedAction: "No prep needed for lunch — just log it with the Office Lunch quick-add when it happens.",
        data: { minutesUntilArriveHome: arriveMin - nowMin },
      });
    }
  }

  // --- evening window: home, discretionary time ---
  if (nowMin >= arriveMin) {
    insights.push({
      id: "workday.evening_window",
      engine: "workday",
      priority: "low",
      urgency: "none",
      tone: "encouraging",
      summary: "Home for the evening — the most flexible part of the day.",
      reason: "Evenings are usually the only real discretionary time in a workday for a workout or unhurried meal prep.",
      recommendedAction: "This is a good window for today's workout or prepping tomorrow's breakfast if either hasn't happened yet.",
      data: {},
    });
  }

  return insights;
}
