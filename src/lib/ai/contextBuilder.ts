/**
 * AI Context Builder
 * ---------------------------------------------------------------------------
 * The one place that's allowed to be impure in the AI Coach pipeline: it
 * fetches real data through the repository layer (src/lib/db), shapes it
 * into each engine's plain-data input, runs every engine, and hands the
 * combined insights to the Decision Engine. Everything downstream of this
 * file (decisionEngine, responseLayer) is pure and independently tested;
 * this file is the seam where "the database" meets "the engines."
 */
import { usersRepository } from "@/lib/db/users.repository";
import { settingsRepository } from "@/lib/db/settings.repository";
import { weightsRepository } from "@/lib/db/weights.repository";
import { mealsRepository } from "@/lib/db/meals.repository";
import { waterLogsRepository } from "@/lib/db/waterLogs.repository";
import { workoutsRepository } from "@/lib/db/workouts.repository";
import { sleepLogsRepository } from "@/lib/db/sleepLogs.repository";
import { cyclesRepository } from "@/lib/db/cycles.repository";
import { motivationsRepository } from "@/lib/db/motivations.repository";

import { DEFAULT_GOALS } from "@/lib/utils/constants";
import { todayISODate } from "@/lib/utils/format";
import {
  buildDailyLogInputs,
  computeDailyCoachScores,
  getLastNDates,
  ageFromDateOfBirth,
  estimateMaintenanceCalories,
  chunkDatesIntoWeeks,
  computeTrailingWeeklyChangesKg,
} from "@/lib/coach";
import type { DailyGoals } from "@/lib/coach/types";
import type { PlannerUserContext } from "@/lib/planner";

import {
  runBehaviorEngine,
  runNutritionEngine,
  runExerciseEngine,
  runMaintenanceEngine,
  runWhyEngine,
  runMigraineEngine,
  runMenstrualEngine,
  runThyroidEngine,
  runWorkdayEngine,
  runAdaptiveLearningEngine,
  runDecisionEngine,
  largestGapHours,
  buildHistoricalDayRecords,
  type EngineInsight,
  type CoachDecision,
} from "@/lib/engines";

import type { MealType, UserProfile } from "@/types/firestore";

const HISTORY_WINDOW_DAYS = 28;

export interface AICoachContext {
  profile: UserProfile;
  goals: DailyGoals;
  generatedAt: string;
}

/** Builds the validated context consumed by the pure Planning Layer. */
export async function buildPlannerUserContext(
  userId: string,
): Promise<PlannerUserContext> {
  const [profile, settings] = await Promise.all([
    usersRepository.getByUid(userId),
    settingsRepository.getForUser(userId),
  ]);
  if (!profile) {
    throw new Error(`No profile found for user ${userId}`);
  }

  const now = new Date();
  return {
    today: todayISODate(),
    currentHour: now.getHours(),
    currentMinute: now.getMinutes(),
    leaveHomeTime: profile.leaveHomeTime,
    arriveHomeTime: profile.arriveHomeTime,
    lunchProvidedByOffice: profile.lunchProvidedByOffice,
    calorieGoal: settings?.calorieGoal ?? DEFAULT_GOALS.calorieGoal,
    proteinGoalG: settings?.proteinGoalG ?? DEFAULT_GOALS.proteinGoalG,
    waterGoalMl: settings?.waterGoalMl ?? DEFAULT_GOALS.waterGoalMl,
    workoutGoalMinPerDay:
      settings?.workoutGoalMinPerDay ?? DEFAULT_GOALS.workoutGoalMinPerDay,
    stepsGoal: settings?.stepsGoal ?? DEFAULT_GOALS.stepsGoal,
    sleepGoalHours: settings?.sleepGoalHours ?? DEFAULT_GOALS.sleepGoalHours,
  };
}

/** Fetches everything the engines need and shapes it into their inputs; this is intentionally the only "wide" function in the file — see the individual `run*Engine` calls for what actually decides anything. */
export async function buildCoachDecision(userId: string): Promise<CoachDecision> {
  const today = todayISODate();
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const [profile, settings, weights, meals, waterLogs, workouts, sleepLogs, cycles, motivations] =
    await Promise.all([
      usersRepository.getByUid(userId),
      settingsRepository.getForUser(userId),
      weightsRepository.listForUser(userId, 90),
      mealsRepository.listForUserRange(userId, 400),
      waterLogsRepository.listForUser(userId, 400),
      workoutsRepository.listForUser(userId, 200),
      sleepLogsRepository.listForUser(userId, 90),
      cyclesRepository.listForUser(userId),
      motivationsRepository.listActiveForUser(userId),
    ]);

  if (!profile) {
    throw new Error(`No profile found for user ${userId}`);
  }

  const goals: DailyGoals = {
    calorieGoal: settings?.calorieGoal ?? DEFAULT_GOALS.calorieGoal,
    proteinGoalG: settings?.proteinGoalG ?? DEFAULT_GOALS.proteinGoalG,
    waterGoalMl: settings?.waterGoalMl ?? DEFAULT_GOALS.waterGoalMl,
    workoutGoalMinPerDay: settings?.workoutGoalMinPerDay ?? DEFAULT_GOALS.workoutGoalMinPerDay,
    sleepGoalHours: settings?.sleepGoalHours ?? DEFAULT_GOALS.sleepGoalHours,
  };

  const historyDates = getLastNDates(HISTORY_WINDOW_DAYS, today);
  const dailyInputs = buildDailyLogInputs(historyDates, { meals, waterLogs, workouts, sleepLogs });
  const dailyScores = computeDailyCoachScores(dailyInputs, goals);
  const todayInputs = dailyInputs[dailyInputs.length - 1];

  const hasLoggedToday =
    todayInputs.caloriesConsumed > 0 ||
    todayInputs.waterMl > 0 ||
    todayInputs.workoutMinutes > 0 ||
    todayInputs.sleepHours != null ||
    weights.some((w) => w.date === today);

  const todaysMealTimestamps = meals
    .filter((m) => m.date === today)
    .map((m) => ({ type: m.type as MealType, loggedAt: m.createdAt }));
  const todaysMealGapHours = largestGapHours(todaysMealTimestamps);

  // --- Behavior ---
  const behaviorInsights = runBehaviorEngine({ dailyScores, hasLoggedToday, currentHour });

  // --- Nutrition ---
  const nutritionInsights = runNutritionEngine({
    today: todayInputs,
    goals,
    todaysMealTimestamps,
    lunchProvidedByOffice: profile.lunchProvidedByOffice,
    currentHour,
  });

  // --- Exercise ---
  const recentWorkoutNames = workouts
    .filter((w) => historyDates.includes(w.date))
    .map((w) => w.name);
  const daysSinceLastWorkout = daysSinceMostRecent(workouts.map((w) => w.date), today);
  const exerciseInsights = runExerciseEngine({
    todayWorkoutMinutes: todayInputs.workoutMinutes,
    workoutGoalMinPerDay: goals.workoutGoalMinPerDay,
    recentWorkoutNames,
    daysSinceLastWorkout,
    currentHour,
  });

  // --- Maintenance ---
  const currentWeightKg = weights[0]?.weightKg ?? profile.startWeightKg;
  const weekWindows = chunkDatesIntoWeeks(historyDates);
  const weeklyChanges = computeTrailingWeeklyChangesKg(
    weights.map((w) => ({ date: w.date, weightKg: w.weightKg })),
    weekWindows,
  ).filter((c): c is number => c != null);
  const latestWeeklyChangeKg = weeklyChanges.length > 0 ? weeklyChanges[weeklyChanges.length - 1] : null;
  const maintenanceInsights = runMaintenanceEngine({
    currentWeightKg,
    goalWeightKg: profile.goalWeightKg,
    latestWeeklyChangeKg,
    recentWeeklyChangesKg: weeklyChanges,
  });

  // --- WHY ---
  const whyInsights = runWhyEngine({
    motivations: motivations.map((m) => ({ id: m.id, text: m.text, lastReferencedAt: m.lastReferencedAt })),
    now: now.toISOString(),
  });

  // --- Migraine (symptom log is cycles.symptoms, the app's only free-text symptom log) ---
  const recentSymptomLogs = cycles.map((c) => ({ date: c.startDate, symptoms: c.symptoms }));
  const migraineInsights = runMigraineEngine({ today, recentSymptomLogs, todaysMealGapHours });

  // --- Menstrual ---
  const latestCycleStartDate = cycles[0]?.startDate ?? null;
  const menstrualInsights = runMenstrualEngine({ latestCycleStartDate, today });

  // --- Thyroid ---
  const age = ageFromDateOfBirth(profile.dateOfBirth, today);
  const estimatedMaintenanceCalories =
    age != null && (profile.sex === "male" || profile.sex === "female")
      ? estimateMaintenanceCalories({
          weightKg: currentWeightKg,
          heightCm: profile.heightCm,
          age,
          sex: profile.sex,
        })
      : null;
  const recentReportedSymptoms = cycles.flatMap((c) => c.symptoms);
  const thyroidInsights = runThyroidEngine({
    calorieGoal: goals.calorieGoal,
    estimatedMaintenanceCalories,
    recentReportedSymptoms,
  });

  // --- Workday ---
  const workdayInsights = runWorkdayEngine({
    leaveHomeTime: profile.leaveHomeTime,
    arriveHomeTime: profile.arriveHomeTime,
    lunchProvidedByOffice: profile.lunchProvidedByOffice,
    currentHour,
    currentMinute,
  });

  // --- Adaptive Learning ---
  const waterMlByDate = new Map<string, number>();
  for (const date of historyDates) {
    waterMlByDate.set(
      date,
      waterLogs.filter((w) => w.date === date).reduce((sum, w) => sum + w.amountMl, 0),
    );
  }
  const workoutMinutesByDate = new Map<string, number>();
  for (const date of historyDates) {
    workoutMinutesByDate.set(
      date,
      workouts.filter((w) => w.date === date).reduce((sum, w) => sum + w.durationMin, 0),
    );
  }
  const sleepHoursByDate = new Map<string, number | null>();
  for (const date of historyDates) {
    sleepHoursByDate.set(date, sleepLogs.find((s) => s.date === date)?.hoursSlept ?? null);
  }
  const historicalDayRecords = buildHistoricalDayRecords(historyDates, {
    meals: meals.map((m) => ({ date: m.date, name: m.name, createdAt: m.createdAt, calories: m.macros.calories })),
    waterMlByDate,
    workoutMinutesByDate,
    sleepHoursByDate,
    waterGoalMl: goals.waterGoalMl,
    calorieGoal: goals.calorieGoal,
  });
  const adaptiveLearningInsights = runAdaptiveLearningEngine({ history: historicalDayRecords });

  const allInsights: EngineInsight[] = [
    ...behaviorInsights,
    ...nutritionInsights,
    ...exerciseInsights,
    ...maintenanceInsights,
    ...whyInsights,
    ...migraineInsights,
    ...menstrualInsights,
    ...thyroidInsights,
    ...workdayInsights,
    ...adaptiveLearningInsights,
  ];

  return runDecisionEngine(allInsights, { now: now.toISOString() });
}

/** Also exposed for any future caller that wants the raw context (profile + goals) without running the engines. */
export async function buildAICoachContext(userId: string): Promise<AICoachContext> {
  const profile = await usersRepository.getByUid(userId);
  if (!profile) {
    throw new Error(`No profile found for user ${userId}`);
  }
  const settings = await settingsRepository.getForUser(userId);
  return {
    profile,
    goals: {
      calorieGoal: settings?.calorieGoal ?? DEFAULT_GOALS.calorieGoal,
      proteinGoalG: settings?.proteinGoalG ?? DEFAULT_GOALS.proteinGoalG,
      waterGoalMl: settings?.waterGoalMl ?? DEFAULT_GOALS.waterGoalMl,
      workoutGoalMinPerDay: settings?.workoutGoalMinPerDay ?? DEFAULT_GOALS.workoutGoalMinPerDay,
      sleepGoalHours: settings?.sleepGoalHours ?? DEFAULT_GOALS.sleepGoalHours,
    },
    generatedAt: new Date().toISOString(),
  };
}

function daysSinceMostRecent(dates: string[], today: string): number {
  if (dates.length === 0) return Number.POSITIVE_INFINITY;
  const mostRecent = [...dates].sort().reverse()[0];
  const diffMs = new Date(today).getTime() - new Date(mostRecent).getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}
