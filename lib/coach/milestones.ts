/**
 * Coach Layer — Milestones
 * ---------------------------------------------------------------------------
 * Each category is a simple threshold check over already-logged history —
 * no prediction, no generated copy beyond a small fixed template per
 * threshold. Every function reports the *highest* threshold crossed rather
 * than every one crossed along the way, so the UI shows one clear
 * "you are here" milestone per category instead of a flood of old ones.
 */
import type { DailyCoachScore, Milestone } from "./types";

const WEIGHT_LOSS_THRESHOLDS_KG = [1, 3, 5, 10, 15, 20, 30];
const STREAK_THRESHOLD_SCORE = 70;
const STREAK_MILESTONE_DAYS = [3, 7, 14, 30, 60];
const WORKOUT_COUNT_MILESTONES = [1, 5, 10, 25, 50, 100];

export interface WeightMilestoneInput {
  weights: { date: string; weightKg: number }[];
  startWeightKg: number;
  goalWeightKg: number;
}

export function computeWeightMilestones({
  weights,
  startWeightKg,
  goalWeightKg,
}: WeightMilestoneInput): Milestone[] {
  if (weights.length === 0) return [];

  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const milestones: Milestone[] = [
    {
      id: "weight-first-entry",
      category: "weight",
      title: "First weigh-in logged",
      description: "You started tracking your weight — the most important first step.",
      achievedDate: earliest.date,
    },
  ];

  const totalLostKg = startWeightKg - latest.weightKg;
  const crossedLossThresholds = WEIGHT_LOSS_THRESHOLDS_KG.filter((t) => totalLostKg >= t);
  if (crossedLossThresholds.length > 0) {
    const highest = crossedLossThresholds[crossedLossThresholds.length - 1];
    milestones.push({
      id: `weight-lost-${highest}kg`,
      category: "weight",
      title: `Lost ${highest} kg`,
      description: `${totalLostKg.toFixed(1)} kg down since you started — past the ${highest} kg mark.`,
      achievedDate: latest.date,
    });
  }

  const totalToLoseKg = startWeightKg - goalWeightKg;
  if (totalToLoseKg > 0) {
    const progressPercent = (totalLostKg / totalToLoseKg) * 100;
    if (progressPercent >= 50) {
      milestones.push({
        id: "weight-halfway",
        category: "weight",
        title: "Halfway to goal",
        description: "You're over halfway to your goal weight. Keep going!",
        achievedDate: latest.date,
      });
    }
    if (latest.weightKg <= goalWeightKg) {
      milestones.push({
        id: "weight-goal-reached",
        category: "weight",
        title: "Goal weight reached!",
        description: `You've reached your goal weight of ${goalWeightKg} kg.`,
        achievedDate: latest.date,
      });
    }
  }

  return milestones;
}

/** Longest currently-active streak of days scoring >= STREAK_THRESHOLD_SCORE, walking back from the most recent day. */
export function computeStreakMilestones(dailyScores: DailyCoachScore[]): Milestone[] {
  if (dailyScores.length === 0) return [];

  const sorted = [...dailyScores].sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].overall >= STREAK_THRESHOLD_SCORE) {
      streak += 1;
    } else {
      break;
    }
  }

  const crossed = STREAK_MILESTONE_DAYS.filter((d) => streak >= d);
  if (crossed.length === 0) return [];

  const highest = crossed[crossed.length - 1];
  return [
    {
      id: `streak-${highest}-days`,
      category: "streak",
      title: `${highest}-day streak`,
      description: `Your Coach Score has stayed at ${STREAK_THRESHOLD_SCORE}+ for ${highest} days in a row.`,
      achievedDate: sorted[sorted.length - 1].date,
    },
  ];
}

export function computeWorkoutMilestones(workouts: { date: string }[]): Milestone[] {
  if (workouts.length === 0) return [];

  const count = workouts.length;
  const crossed = WORKOUT_COUNT_MILESTONES.filter((c) => count >= c);
  if (crossed.length === 0) return [];

  const highest = crossed[crossed.length - 1];
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

  return [
    {
      id: `workout-count-${highest}`,
      category: "workout",
      title: highest === 1 ? "First workout logged" : `${highest} workouts logged`,
      description:
        highest === 1
          ? "You logged your first workout — great start!"
          : `You've logged ${highest} workouts total. Consistency is paying off.`,
      achievedDate: sorted[sorted.length - 1].date,
    },
  ];
}

export interface MilestonesInput {
  weights: { date: string; weightKg: number }[];
  startWeightKg: number;
  goalWeightKg: number;
  workouts: { date: string }[];
  dailyScores: DailyCoachScore[];
}

export function computeMilestones(input: MilestonesInput): Milestone[] {
  return [
    ...computeWeightMilestones({
      weights: input.weights,
      startWeightKg: input.startWeightKg,
      goalWeightKg: input.goalWeightKg,
    }),
    ...computeStreakMilestones(input.dailyScores),
    ...computeWorkoutMilestones(input.workouts),
  ];
}
