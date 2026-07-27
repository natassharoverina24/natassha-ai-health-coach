/**
 * Adaptive Learning Engine
 * ---------------------------------------------------------------------------
 * Detects recurring patterns over historical data (weekend dessert,
 * late-night hunger, skipped workouts, stress eating, low hydration) and
 * turns each into an *adapted* recommendation rather than a one-off
 * observation — the point isn't to flag the pattern once, it's to notice
 * it's recurring and suggest working *with* it instead of against it.
 *
 * Every detector needs a minimum number of occurrences before firing, so a
 * single coincidence never gets mistaken for a pattern.
 */
import type { EngineInsight } from "./types";

const MIN_WEEKEND_DAYS_FOR_PATTERN = 3;
const MIN_LATE_NIGHT_DAYS_FOR_PATTERN = 3;
const MIN_SKIPPED_WORKOUT_OCCURRENCES = 3;
const SKIPPED_WORKOUT_DAY_RATIO = 0.7;
const MIN_LOW_HYDRATION_DAYS_FOR_PATTERN = 4;
const LOW_HYDRATION_THRESHOLD_PERCENT = 50;
const MIN_STRESS_EATING_OCCURRENCES = 3;
const LOW_SLEEP_THRESHOLD_HOURS = 6;
const OVERSHOOT_RATIO = 1.15;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface HistoricalDayRecord {
  date: string; // "YYYY-MM-DD"
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  waterAdherencePercent: number; // 0-100, vs that day's goal
  workoutMinutes: number;
  sleepHours: number | null;
  caloriesConsumed: number;
  calorieGoal: number;
  lateNightMealLogged: boolean; // any meal logged at/after ~21:00
  dessertLikeMealLogged: boolean;
}

export interface AdaptiveLearningEngineInput {
  /** Oldest-first history, ideally 30+ days for reliable pattern detection. */
  history: HistoricalDayRecord[];
}

function isWeekend(dayOfWeek: number): boolean {
  return dayOfWeek === 0 || dayOfWeek === 6;
}

export function runAdaptiveLearningEngine(input: AdaptiveLearningEngineInput): EngineInsight[] {
  const { history } = input;
  const insights: EngineInsight[] = [];

  // --- weekend dessert pattern ---
  const weekendDays = history.filter((d) => isWeekend(d.dayOfWeek));
  const weekendDessertDays = weekendDays.filter((d) => d.dessertLikeMealLogged);
  const weekdayDessertDays = history.filter((d) => !isWeekend(d.dayOfWeek) && d.dessertLikeMealLogged);
  if (
    weekendDessertDays.length >= MIN_WEEKEND_DAYS_FOR_PATTERN &&
    weekendDays.length > 0 &&
    weekendDessertDays.length / weekendDays.length > 0.5 &&
    weekdayDessertDays.length / Math.max(history.length - weekendDays.length, 1) < 0.25
  ) {
    insights.push({
      id: "adaptive.weekend_dessert_pattern",
      engine: "adaptiveLearning",
      priority: "low",
      urgency: "none",
      tone: "neutral",
      summary: "Dessert shows up on most weekends but rarely on weekdays.",
      reason: "This is a consistent enough pattern that it's more useful to plan around than to treat as a slip each time.",
      recommendedAction: "Build a planned weekend treat into the week's targets instead of treating it as an exception every time.",
      data: {
        weekendDessertDays: weekendDessertDays.length,
        weekendDaysObserved: weekendDays.length,
      },
    });
  }

  // --- late-night hunger pattern ---
  const lateNightDays = history.filter((d) => d.lateNightMealLogged);
  if (lateNightDays.length >= MIN_LATE_NIGHT_DAYS_FOR_PATTERN) {
    insights.push({
      id: "adaptive.late_night_hunger_pattern",
      engine: "adaptiveLearning",
      priority: "low",
      urgency: "none",
      tone: "neutral",
      summary: `Late-night eating logged on ${lateNightDays.length} of the last ${history.length} days.`,
      reason: "A recurring late-night pattern usually means daytime meals aren't covering enough volume or protein, not a willpower issue at night.",
      recommendedAction: "Try adding more protein or volume to dinner, or plan a small evening snack in advance rather than reacting to it.",
      data: { lateNightDays: lateNightDays.length, daysObserved: history.length },
    });
  }

  // --- skipped workouts by day-of-week ---
  const skippedByDow = skippedWorkoutDayOfWeekPattern(history);
  if (skippedByDow) {
    insights.push({
      id: "adaptive.skipped_workout_day_pattern",
      engine: "adaptiveLearning",
      priority: "medium",
      urgency: "none",
      tone: "neutral",
      summary: `Workouts are skipped on ${DAY_NAMES[skippedByDow.dayOfWeek]} more than any other day.`,
      reason: "A day-specific pattern usually points to a real schedule conflict on that day, not a motivation problem.",
      recommendedAction: `Consider moving the ${DAY_NAMES[skippedByDow.dayOfWeek]} workout to a different day, or planning a shorter version specifically for that day.`,
      data: { dayOfWeek: skippedByDow.dayOfWeek, skippedCount: skippedByDow.skippedCount, observedCount: skippedByDow.observedCount },
    });
  }

  // --- low hydration pattern ---
  const lowHydrationDays = history.filter((d) => d.waterAdherencePercent < LOW_HYDRATION_THRESHOLD_PERCENT);
  if (lowHydrationDays.length >= MIN_LOW_HYDRATION_DAYS_FOR_PATTERN) {
    insights.push({
      id: "adaptive.low_hydration_pattern",
      engine: "adaptiveLearning",
      priority: "low",
      urgency: "none",
      tone: "neutral",
      summary: `Water intake was under ${LOW_HYDRATION_THRESHOLD_PERCENT}% of goal on ${lowHydrationDays.length} of the last ${history.length} days.`,
      reason: "A recurring hydration shortfall is usually a logging-friction problem more than a habit problem — the goal or the reminder timing may be off.",
      recommendedAction: "Try the 500ml or 1L quick-add buttons instead of 250ml to close the gap faster with fewer taps.",
      data: { lowHydrationDays: lowHydrationDays.length, daysObserved: history.length },
    });
  }

  // --- stress eating proxy: low sleep followed by calorie overshoot ---
  const stressEatingCount = stressEatingOccurrences(history);
  if (stressEatingCount >= MIN_STRESS_EATING_OCCURRENCES) {
    insights.push({
      id: "adaptive.stress_eating_pattern",
      engine: "adaptiveLearning",
      priority: "medium",
      urgency: "none",
      tone: "gentle",
      summary: `Days following under ${LOW_SLEEP_THRESHOLD_HOURS} hours of sleep tend to run well over the calorie goal.`,
      reason: "Poor sleep reliably increases next-day hunger and cravings via appetite hormones — this is physiological, not a discipline gap.",
      recommendedAction: "On low-sleep days, plan a higher-protein breakfast in advance rather than trying to white-knuckle the calorie goal.",
      data: { occurrences: stressEatingCount },
    });
  }

  return insights;
}

function skippedWorkoutDayOfWeekPattern(
  history: HistoricalDayRecord[],
): { dayOfWeek: number; skippedCount: number; observedCount: number } | null {
  const byDow = new Map<number, { skipped: number; total: number }>();
  for (const day of history) {
    const bucket = byDow.get(day.dayOfWeek) ?? { skipped: 0, total: 0 };
    bucket.total += 1;
    if (day.workoutMinutes === 0) bucket.skipped += 1;
    byDow.set(day.dayOfWeek, bucket);
  }

  let worst: { dayOfWeek: number; skippedCount: number; observedCount: number } | null = null;
  for (const [dayOfWeek, bucket] of byDow.entries()) {
    if (bucket.skipped < MIN_SKIPPED_WORKOUT_OCCURRENCES) continue;
    if (bucket.skipped / bucket.total < SKIPPED_WORKOUT_DAY_RATIO) continue;
    if (!worst || bucket.skipped > worst.skippedCount) {
      worst = { dayOfWeek, skippedCount: bucket.skipped, observedCount: bucket.total };
    }
  }
  return worst;
}

function stressEatingOccurrences(history: HistoricalDayRecord[]): number {
  let count = 0;
  for (let i = 1; i < history.length; i += 1) {
    const prevNight = history[i - 1];
    const nextDay = history[i];
    if (prevNight.sleepHours == null) continue;
    const lowSleep = prevNight.sleepHours < LOW_SLEEP_THRESHOLD_HOURS;
    const overshot = nextDay.calorieGoal > 0 && nextDay.caloriesConsumed > nextDay.calorieGoal * OVERSHOOT_RATIO;
    if (lowSleep && overshot) count += 1;
  }
  return count;
}

const DESSERT_KEYWORDS = [
  "dessert",
  "cake",
  "ice cream",
  "cookie",
  "chocolate",
  "candy",
  "sweet drink",
  "kolak",
  "pudding",
  "donut",
  "pastry",
];
const LATE_NIGHT_HOUR = 21;

export interface HistoricalMealRecord {
  date: string;
  name: string;
  createdAt: string; // ISO datetime
  calories: number;
}

export interface HistoricalDaySources {
  meals: HistoricalMealRecord[];
  waterMlByDate: Map<string, number>;
  workoutMinutesByDate: Map<string, number>;
  sleepHoursByDate: Map<string, number | null>;
  waterGoalMl: number;
  calorieGoal: number;
}

function dayOfWeekFromISODate(isoDate: string): number {
  // Parsed as UTC midnight so this matches the date string exactly regardless of local timezone.
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

/** Builds the per-day records the Adaptive Learning Engine's pattern detectors consume, from raw logs. */
export function buildHistoricalDayRecords(dates: string[], sources: HistoricalDaySources): HistoricalDayRecord[] {
  return dates.map((date) => {
    const dayMeals = sources.meals.filter((m) => m.date === date);
    const caloriesConsumed = dayMeals.reduce((sum, m) => sum + m.calories, 0);
    const waterMl = sources.waterMlByDate.get(date) ?? 0;
    const workoutMinutes = sources.workoutMinutesByDate.get(date) ?? 0;
    const sleepHours = sources.sleepHoursByDate.get(date) ?? null;

    return {
      date,
      dayOfWeek: dayOfWeekFromISODate(date),
      waterAdherencePercent: sources.waterGoalMl > 0 ? Math.min(100, (waterMl / sources.waterGoalMl) * 100) : 0,
      workoutMinutes,
      sleepHours,
      caloriesConsumed,
      calorieGoal: sources.calorieGoal,
      lateNightMealLogged: dayMeals.some((m) => new Date(m.createdAt).getHours() >= LATE_NIGHT_HOUR),
      dessertLikeMealLogged: dayMeals.some((m) =>
        DESSERT_KEYWORDS.some((kw) => m.name.toLowerCase().includes(kw)),
      ),
    };
  });
}
