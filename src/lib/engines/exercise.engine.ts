/**
 * Exercise Engine
 * ---------------------------------------------------------------------------
 * Knowledge rules: treadmill-first strategy, walking default, HIIT
 * optional, minimum action rule, prioritize adherence over intensity.
 */
import type { EngineInsight } from "./types";

const MINIMUM_ACTION_MINUTES = 10;
const HIIT_ELIGIBLE_RECENT_COUNT = 2;
const ADHERENCE_RISK_DAYS = 3;

export interface ExerciseEngineInput {
  todayWorkoutMinutes: number;
  workoutGoalMinPerDay: number;
  /** Workout names/types logged over the last ~14 days, most recent last. */
  recentWorkoutNames: string[];
  /** Days since the last workout of any kind (0 = today). */
  daysSinceLastWorkout: number;
  currentHour: number;
}

function looksLikeHiit(name: string): boolean {
  return /hiit|interval|sprint/i.test(name);
}

export function runExerciseEngine(input: ExerciseEngineInput): EngineInsight[] {
  const { todayWorkoutMinutes, workoutGoalMinPerDay, recentWorkoutNames, daysSinceLastWorkout, currentHour } = input;
  const insights: EngineInsight[] = [];

  const metGoalToday = todayWorkoutMinutes >= workoutGoalMinPerDay && workoutGoalMinPerDay > 0;

  // --- prioritize adherence: multi-day gap outranks everything else here ---
  if (daysSinceLastWorkout >= ADHERENCE_RISK_DAYS) {
    insights.push({
      id: "exercise.adherence_risk",
      engine: "exercise",
      priority: "high",
      urgency: "now",
      tone: "firm",
      summary: `${daysSinceLastWorkout} days since the last workout.`,
      reason: "Consistency of showing up matters far more than any single session's intensity — a multi-day gap is the pattern most likely to turn into stopping altogether.",
      recommendedAction: "Do the smallest possible version today: a 10-minute walk counts as a workout and rebuilds the habit.",
      data: { daysSinceLastWorkout },
    });
    return insights; // don't pile on more exercise suggestions on top of this one
  }

  // --- minimum action rule + treadmill-first / walking default ---
  if (!metGoalToday && currentHour >= 17) {
    const recentHiitCount = recentWorkoutNames.filter(looksLikeHiit).length;
    const hiitIsOptional = recentHiitCount >= HIIT_ELIGIBLE_RECENT_COUNT;

    insights.push({
      id: "exercise.minimum_action",
      engine: "exercise",
      priority: todayWorkoutMinutes === 0 ? "medium" : "low",
      urgency: "soon",
      tone: "encouraging",
      summary:
        todayWorkoutMinutes === 0
          ? "No workout logged yet today."
          : `${todayWorkoutMinutes} of ${workoutGoalMinPerDay} minutes logged today.`,
      reason: "Walking (treadmill or outside) is the default recommendation because it's the option with the fewest barriers to actually doing it — the minimum viable workout beats a skipped ideal one.",
      recommendedAction: hiitIsOptional
        ? "A walk works fine today, or a short HIIT session if there's more energy for it — either counts."
        : "A brisk walk (treadmill is fine) for the remaining minutes is the simplest way to close today's gap.",
      data: {
        todayWorkoutMinutes,
        workoutGoalMinPerDay,
        remainingMinutes: Math.max(workoutGoalMinPerDay - todayWorkoutMinutes, MINIMUM_ACTION_MINUTES),
        hiitOptional: hiitIsOptional,
      },
    });
  }

  return insights;
}
