/**
 * Migraine Engine
 * ---------------------------------------------------------------------------
 * There's no dedicated migraine-tracking collection — this engine works
 * from the free-text `symptoms` already logged on `cycles` entries (the
 * app's only symptom log) plus recent meal-timing gap data, and correlates
 * them. It never diagnoses; it only notices co-occurring patterns and
 * recommends the same migraine-safe habits (regular meals, hydration,
 * gentler activity) the Nutrition/Exercise engines already know about.
 */
import type { EngineInsight } from "./types";

const MIGRAINE_KEYWORDS = ["migraine", "headache"];
const RECENT_DAYS_FOR_ACTIVE_CHECK = 2;

export interface SymptomLogEntry {
  date: string; // "YYYY-MM-DD"
  symptoms: string[];
}

export interface MigraineEngineInput {
  today: string;
  recentSymptomLogs: SymptomLogEntry[];
  /** Largest gap between meals today, in hours (from the Nutrition Engine's own calculation). */
  todaysMealGapHours: number;
}

function hasMigraineSymptom(symptoms: string[]): boolean {
  return symptoms.some((s) => MIGRAINE_KEYWORDS.some((kw) => s.toLowerCase().includes(kw)));
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
}

export function runMigraineEngine(input: MigraineEngineInput): EngineInsight[] {
  const { today, recentSymptomLogs, todaysMealGapHours } = input;
  const insights: EngineInsight[] = [];

  const recentMigraineLogs = recentSymptomLogs.filter(
    (log) => hasMigraineSymptom(log.symptoms) && daysBetween(log.date, today) <= RECENT_DAYS_FOR_ACTIVE_CHECK,
  );

  if (recentMigraineLogs.length === 0) return insights;

  // --- symptom-aware coaching: a migraine was logged very recently ---
  insights.push({
    id: "migraine.active_symptom_care",
    engine: "migraine",
    priority: "high",
    urgency: "now",
    tone: "gentle",
    summary: "A migraine or headache was logged in the last two days.",
    reason: "Migraine days call for lower-intensity movement and steady hydration/meal timing rather than pushing through a normal plan.",
    recommendedAction: "Skip intense exercise today, favor gentle movement or rest, and keep meals small and regular.",
    data: { recentMigraineLogCount: recentMigraineLogs.length },
    suppresses: ["exercise"],
  });

  // --- correlation with meal timing ---
  if (todaysMealGapHours > 5) {
    insights.push({
      id: "migraine.meal_gap_correlation",
      engine: "migraine",
      priority: "medium",
      urgency: "soon",
      tone: "gentle",
      summary: "Today's longest meal gap is also unusually long, alongside a recent migraine.",
      reason: "Skipped or delayed meals are one of the more common migraine triggers — this looks like a pattern worth a small structural fix.",
      recommendedAction: "Try setting a recurring reminder for a mid-afternoon snack to keep meal gaps under about 5 hours.",
      data: { todaysMealGapHours },
    });
  }

  return insights;
}
