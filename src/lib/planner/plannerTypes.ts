/**
 * Planning Layer — Types
 * ---------------------------------------------------------------------------
 * The structured output of the Daily Planner, per AI_PLANNING_SPEC.md §2.
 * Pure types only — no logic, no imports from React/Firebase/engines.
 *
 * The Planning Layer consumes two inputs (AI_PLANNING_SPEC.md §11):
 *   1. CoachDecision — the ranked insights already decided by the engines.
 *   2. PlannerUserContext — the validated user context already assembled by
 *      the application's context builder. The planner never reads Firestore
 *      directly.
 */

// ---------------------------------------------------------------------------
// Input: validated user context (supplied, never self-fetched)
// ---------------------------------------------------------------------------

export interface PlannerUserContext {
  /** Today's date, "YYYY-MM-DD". */
  today: string;
  /** Current local hour (0-23) and minute (0-59). */
  currentHour: number;
  currentMinute: number;

  /** From UserProfile — used to place meal/workout times around the commute. */
  leaveHomeTime: string; // "HH:mm"
  arriveHomeTime: string; // "HH:mm"
  lunchProvidedByOffice: boolean;

  /** From UserSettings or DEFAULT_GOALS — the targets the Daily Plan surfaces. */
  calorieGoal: number;
  proteinGoalG: number;
  waterGoalMl: number;
  workoutGoalMinPerDay: number;
  stepsGoal: number;
  sleepGoalHours: number;
}

// ---------------------------------------------------------------------------
// Output: the Daily Plan
// ---------------------------------------------------------------------------

export interface DailyTargets {
  calories: number;
  proteinG: number;
  waterMl: number;
  workoutMin: number;
  steps: number;
  sleepHours: number;
}

export interface ScheduleSlot {
  label: string;
  /** Suggested time in "HH:mm" format. */
  time: string;
}

export interface DailySchedule {
  breakfast: ScheduleSlot;
  lunch: ScheduleSlot;
  snack: ScheduleSlot;
  dinner: ScheduleSlot;
  workout: ScheduleSlot;
  waterReminder: ScheduleSlot;
}

export interface InsightSummary {
  id: string;
  summary: string;
  recommendedAction: string;
}

export interface DailySummary {
  /** The highest-ranked insight, always present when any insight exists. */
  topPriority: InsightSummary | null;
  /** Same as topPriority UNLESS the top insight is celebratory (good day, no risk). */
  biggestRisk: InsightSummary | null;
  /** The highest-ranked celebratory insight, or null on days without a win to report. */
  todaysWin: InsightSummary | null;
  /** A long-term motivation from the WHY Engine, or null when on cooldown / not stored. */
  encouragement: string | null;
}

export interface DailyPlan {
  targets: DailyTargets;
  schedule: DailySchedule;
  summary: DailySummary;
  generatedAt: string;
}
