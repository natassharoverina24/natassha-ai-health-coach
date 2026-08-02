"use client";

import { useMemo } from "react";
import { Ruler, Sparkles, TrendingDown } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreCollection, useFirestoreDoc } from "@/hooks";
import { weightsRepository } from "@/lib/db/weights.repository";
import { waistsRepository } from "@/lib/db/waists.repository";
import { mealsRepository } from "@/lib/db/meals.repository";
import { waterLogsRepository } from "@/lib/db/waterLogs.repository";
import { workoutsRepository } from "@/lib/db/workouts.repository";
import { sleepLogsRepository } from "@/lib/db/sleepLogs.repository";
import { settingsRepository } from "@/lib/db/settings.repository";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import {
  CoachScoreCard,
  MilestonesList,
  WeeklyKpiCard,
  WeeklyReviewCard,
  WorkoutSleepQuickLogCard,
} from "@/components/coach";
import { DEFAULT_GOALS } from "@/lib/utils/constants";
import { formatDateLabel, formatDelta, todayISODate } from "@/lib/utils/format";
import {
  buildDailyLogInputs,
  computeCoachScoreSummary,
  computeDailyCoachScores,
  computeMilestones,
  computeWeeklyKpi,
  computeWeeklyReview,
  getLastNDates,
} from "@/lib/coach";
import type {
  MealEntry,
  SleepEntry,
  UserSettings,
  WaistEntry,
  WaterLogEntry,
  WeightEntry,
  WorkoutEntry,
} from "@/types/firestore";

const HISTORY_WINDOW_DAYS = 30;

export default function ProgressPage() {
  const { user, profile } = useAuth();
  const uid = user?.uid ?? null;
  const today = useMemo(() => todayISODate(), []);

  const { data: weights, loading: weightsLoading } = useFirestoreCollection<WeightEntry>(
    uid ? (onData, onError) => weightsRepository.subscribeForUser(uid, onData, onError, 180) : null,
    [uid],
  );

  const { data: waists, loading: waistsLoading } = useFirestoreCollection<WaistEntry>(
    uid ? (onData, onError) => waistsRepository.subscribeForUser(uid, onData, onError, 180) : null,
    [uid],
  );

  const { data: meals, loading: mealsLoading } = useFirestoreCollection<MealEntry>(
    uid ? (onData, onError) => mealsRepository.subscribeForUser(uid, onData, onError, 400) : null,
    [uid],
  );

  const { data: waterEntries, loading: waterLoading } = useFirestoreCollection<WaterLogEntry>(
    uid ? (onData, onError) => waterLogsRepository.subscribeForUser(uid, onData, onError, 500) : null,
    [uid],
  );

  const { data: workouts, loading: workoutsLoading } = useFirestoreCollection<WorkoutEntry>(
    uid ? (onData, onError) => workoutsRepository.subscribeForUser(uid, onData, onError, 200) : null,
    [uid],
  );

  const { data: sleepLogs, loading: sleepLoading } = useFirestoreCollection<SleepEntry>(
    uid ? (onData, onError) => sleepLogsRepository.subscribeForUser(uid, onData, onError, 90) : null,
    [uid],
  );

  const { data: settings } = useFirestoreDoc<UserSettings>(
    uid ? (onData, onError) => settingsRepository.subscribeForUser(uid, onData, onError) : null,
    [uid],
  );

  const goals = {
    calorieGoal: settings?.calorieGoal ?? DEFAULT_GOALS.calorieGoal,
    proteinGoalG: settings?.proteinGoalG ?? DEFAULT_GOALS.proteinGoalG,
    waterGoalMl: settings?.waterGoalMl ?? DEFAULT_GOALS.waterGoalMl,
    workoutGoalMinPerDay: settings?.workoutGoalMinPerDay ?? DEFAULT_GOALS.workoutGoalMinPerDay,
    sleepGoalHours: settings?.sleepGoalHours ?? DEFAULT_GOALS.sleepGoalHours,
  };

  // ---- Coach layer: turn 30 days of raw logs into daily scores ------------

  const historyDates = useMemo(() => getLastNDates(HISTORY_WINDOW_DAYS, today), [today]);
  const dailyInputs = buildDailyLogInputs(historyDates, { meals, waterLogs: waterEntries, workouts, sleepLogs });
  const dailyScores = computeDailyCoachScores(dailyInputs, goals);

  const currentWeekDates = historyDates.slice(-7);
  const currentWeekInputs = dailyInputs.slice(-7);
  const previousWeekInputs = dailyInputs.slice(-14, -7);

  const coachSummary = computeCoachScoreSummary(currentWeekInputs, previousWeekInputs, goals);

  const weightsInCurrentWeek = weights
    .filter((w) => currentWeekDates.includes(w.date))
    .map((w) => ({ date: w.date, weightKg: w.weightKg }));
  const waistsInCurrentWeek = waists
    .filter((w) => currentWeekDates.includes(w.date))
    .map((w) => ({ date: w.date, waistCm: w.waistCm }));

  const weeklyReview = computeWeeklyReview(currentWeekInputs, goals, weightsInCurrentWeek, waistsInCurrentWeek);
  const kpi = computeWeeklyKpi(weeklyReview.adherence);

  const milestones = computeMilestones({
    weights: weights.map((w) => ({ date: w.date, weightKg: w.weightKg })),
    startWeightKg: profile?.startWeightKg ?? 0,
    goalWeightKg: profile?.goalWeightKg ?? 0,
    workouts: workouts.map((w) => ({ date: w.date })),
    dailyScores,
  });

  const coachScoreTrendData = dailyScores.map((d) => ({ label: formatDateLabel(d.date), value: d.overall }));

  // ---- Today's workout/sleep quick log -------------------------------------

  const todaysWorkouts = workouts.filter((w) => w.date === today);
  const todaysSleep = sleepLogs.find((s) => s.date === today) ?? null;

  const handleLogWorkout = async (name: string, durationMin: number) => {
    if (!uid) return;
    await workoutsRepository.create({ userId: uid, date: today, name, durationMin, note: null });
  };

  const handleLogSleep = async (hoursSlept: number) => {
    if (!uid) return;
    if (todaysSleep) {
      await sleepLogsRepository.update(todaysSleep.id, { hoursSlept });
    } else {
      await sleepLogsRepository.create({ userId: uid, date: today, hoursSlept, note: null });
    }
  };

  // ---- Existing weight/waist trend data (unchanged from Phase 1) ----------

  const weightData = [...weights].reverse().map((w) => ({ label: formatDateLabel(w.date), value: w.weightKg }));
  const waistData = [...waists].reverse().map((w) => ({ label: formatDateLabel(w.date), value: w.waistCm }));

  const first = weights[weights.length - 1];
  const latest = weights[0];
  const totalChange = first && latest ? latest.weightKg - first.weightKg : 0;

  const coachDataLoading =
    weightsLoading || waistsLoading || mealsLoading || waterLoading || workoutsLoading || sleepLoading;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Progress" description="Your full journey, from day one to today." />

      {profile && weights.length > 1 && (
        <GlassCard className="flex items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-petal-soft text-rose-strong">
            <TrendingDown size={20} />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Since {formatDateLabel(first.date)}
            </p>
            <p className="text-lg font-bold text-ink">{formatDelta(totalChange)} total change</p>
          </div>
        </GlassCard>
      )}

      {coachDataLoading ? (
        <CoachSectionSkeleton />
      ) : (
        <>
          <WorkoutSleepQuickLogCard
            todaysWorkouts={todaysWorkouts}
            todaysSleep={todaysSleep}
            onLogWorkout={handleLogWorkout}
            onLogSleep={handleLogSleep}
          />

          <CoachScoreCard summary={coachSummary} />

          <WeeklyReviewCard review={weeklyReview} />

          <WeeklyKpiCard kpi={kpi} />
        </>
      )}

      <GlassCard className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-ink">Weight over time</p>
        {weightsLoading ? (
          <Skeleton className="h-56 w-full rounded-control" />
        ) : weightData.length > 1 ? (
          <TrendLineChart data={weightData} />
        ) : (
          <EmptyState
            title="Not enough data yet"
            description="Log at least two weight entries to see your trend."
          />
        )}
      </GlassCard>

      <GlassCard className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Ruler size={16} className="text-taupe" />
          <p className="text-sm font-semibold text-ink">Waist over time</p>
        </div>
        {waistsLoading ? (
          <Skeleton className="h-56 w-full rounded-control" />
        ) : waistData.length > 1 ? (
          <TrendLineChart data={waistData} color="var(--color-taupe)" unit=" cm" />
        ) : (
          <EmptyState
            title="No measurements yet"
            description="Waist tracking will appear here once you log your first measurement."
          />
        )}
      </GlassCard>

      <GlassCard className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-rose" />
          <p className="text-sm font-semibold text-ink">Coach Score trend</p>
        </div>
        {coachDataLoading ? (
          <Skeleton className="h-56 w-full rounded-control" />
        ) : coachScoreTrendData.some((d) => d.value > 0) ? (
          <TrendLineChart data={coachScoreTrendData} color="var(--color-amber)" unit=" pts" />
        ) : (
          <EmptyState
            title="No score history yet"
            description="Log meals, water, workouts, and sleep to start building your Coach Score."
          />
        )}
      </GlassCard>

      {coachDataLoading ? (
        <Skeleton className="h-40 w-full rounded-card" />
      ) : (
        <MilestonesList milestones={milestones} />
      )}
    </div>
  );
}

function CoachSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-32 w-full rounded-card" />
      <Skeleton className="h-40 w-full rounded-card" />
      <Skeleton className="h-64 w-full rounded-card" />
      <Skeleton className="h-56 w-full rounded-card" />
    </div>
  );
}
