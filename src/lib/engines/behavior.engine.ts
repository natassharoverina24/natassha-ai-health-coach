/**
 * Behavior Engine
 * ---------------------------------------------------------------------------
 * Knowledge rules: self monitoring, accountability, streak recovery,
 * reminders, consistency. Operates on the Coach Score history already
 * computed by src/lib/coach — this engine doesn't recompute scores, it
 * interprets the trend in them.
 */
import type { DailyCoachScore } from "@/lib/coach/types";
import type { EngineInsight } from "./types";

const CONSISTENCY_THRESHOLD_SCORE = 70;
const CONSISTENCY_STREAK_MIN_DAYS = 3;
const DECLINE_LOOKBACK_DAYS = 4;

export interface BehaviorEngineInput {
  /** Oldest-first daily scores, ideally 14+ days for reliable trend/streak detection. */
  dailyScores: DailyCoachScore[];
  /** Whether *anything* has been logged today yet (any meal, water, workout, sleep, or weight entry). */
  hasLoggedToday: boolean;
  /** Current local hour (0-23), used to time reminders sensibly. */
  currentHour: number;
}

function currentStreak(scores: DailyCoachScore[], threshold: number): number {
  let streak = 0;
  for (let i = scores.length - 1; i >= 0; i -= 1) {
    if (scores[i].overall >= threshold) streak += 1;
    else break;
  }
  return streak;
}

export function runBehaviorEngine(input: BehaviorEngineInput): EngineInsight[] {
  const { dailyScores, hasLoggedToday, currentHour } = input;
  const insights: EngineInsight[] = [];

  // --- reminders + self monitoring: nudge if the day is well underway with nothing logged ---
  if (!hasLoggedToday && currentHour >= 14) {
    insights.push({
      id: "behavior.self_monitoring_reminder",
      engine: "behavior",
      priority: currentHour >= 20 ? "high" : "medium",
      urgency: currentHour >= 20 ? "now" : "soon",
      tone: "gentle",
      summary: "Nothing has been logged yet today.",
      reason: "Self-monitoring is the single strongest predictor of staying on track — an unlogged day is invisible to the plan.",
      recommendedAction: "Log at least one thing right now, even just water or a quick weigh-in — momentum matters more than completeness.",
      data: { currentHour },
    });
  }

  if (dailyScores.length === 0) return insights;

  // --- consistency: reward an active streak of good days ---
  const streak = currentStreak(dailyScores, CONSISTENCY_THRESHOLD_SCORE);
  if (streak >= CONSISTENCY_STREAK_MIN_DAYS) {
    insights.push({
      id: "behavior.consistency_reinforcement",
      engine: "behavior",
      priority: "low",
      urgency: "none",
      tone: "celebratory",
      summary: `${streak} days in a row scoring ${CONSISTENCY_THRESHOLD_SCORE}+.`,
      reason: "Consistency compounds — a run of solid days is the actual mechanism behind long-term results, more than any single perfect day.",
      recommendedAction: "Keep the same routine tomorrow — don't change what's already working.",
      data: { streakDays: streak, threshold: CONSISTENCY_THRESHOLD_SCORE },
    });
  }

  // --- streak recovery: yesterday broke a prior streak ---
  const last = dailyScores[dailyScores.length - 1];
  const prev = dailyScores[dailyScores.length - 2];
  if (prev && last.overall < CONSISTENCY_THRESHOLD_SCORE && prev.overall >= CONSISTENCY_THRESHOLD_SCORE) {
    const priorStreak = currentStreak(dailyScores.slice(0, -1), CONSISTENCY_THRESHOLD_SCORE);
    if (priorStreak >= CONSISTENCY_STREAK_MIN_DAYS) {
      insights.push({
        id: "behavior.streak_recovery",
        engine: "behavior",
        priority: "medium",
        urgency: "soon",
        tone: "encouraging",
        summary: `A ${priorStreak}-day streak broke yesterday (score ${last.overall}).`,
        reason: "One off day after a real streak is normal and doesn't erase the progress already made — the risk is treating it as a reason to quit.",
        recommendedAction: "Get back to today's basics — one logged meal and one glass of water is enough to restart the streak.",
        data: { brokenStreakDays: priorStreak, yesterdayScore: last.overall },
      });
    }
  }

  // --- accountability: sustained decline over several days ---
  if (dailyScores.length >= DECLINE_LOOKBACK_DAYS) {
    const recent = dailyScores.slice(-DECLINE_LOOKBACK_DAYS);
    const isDeclining = recent.every((day, i) => i === 0 || day.overall <= recent[i - 1].overall);
    const totalDrop = recent[0].overall - recent[recent.length - 1].overall;
    if (isDeclining && totalDrop >= 15) {
      insights.push({
        id: "behavior.accountability_nudge",
        engine: "behavior",
        priority: "high",
        urgency: "soon",
        tone: "firm",
        summary: `Coach Score has declined for ${DECLINE_LOOKBACK_DAYS} days straight, down ${totalDrop} points.`,
        reason: "A multi-day decline is a pattern, not a bad day — worth naming directly before it becomes the new normal.",
        recommendedAction: "Pick the single easiest dimension to fix today (usually water or meal logging) and just do that one thing.",
        data: { lookbackDays: DECLINE_LOOKBACK_DAYS, totalDrop },
      });
    }
  }

  return insights;
}
