"use client";

import { useMemo } from "react";
import {
  Droplets,
  Flame,
  Footprints,
  Pill,
  Scale,
  Target,
  UtensilsCrossed,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreCollection, useFirestoreDoc } from "@/hooks";
import { weightsRepository } from "@/lib/db/weights.repository";
import { mealsRepository } from "@/lib/db/meals.repository";
import { supplementsRepository, supplementLogsRepository } from "@/lib/db/supplements.repository";
import { waterLogsRepository } from "@/lib/db/waterLogs.repository";
import { settingsRepository } from "@/lib/db/settings.repository";
import { DEFAULT_GOALS } from "@/lib/utils/constants";
import { clampPercent, formatCalories, formatDelta, formatGrams, formatWeightKg, todayISODate } from "@/lib/utils/format";
import { StatCard } from "@/components/dashboard/StatCard";
import { HealthRingsCard } from "@/components/dashboard/HealthRingsCard";
import { WeeklyProgressCard } from "@/components/dashboard/WeeklyProgressCard";
import { AICoachCard } from "@/components/dashboard/AICoachCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDateLabel } from "@/lib/utils/format";
import type {
  MealEntry,
  SupplementDefinition,
  SupplementLog,
  UserSettings,
  WaterLogEntry,
  WeightEntry,
} from "@/types/firestore";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const uid = user?.uid ?? null;
  const today = useMemo(() => todayISODate(), []);

  const { data: weights, loading: weightsLoading } = useFirestoreCollection<WeightEntry>(
    uid ? (onData, onError) => weightsRepository.subscribeForUser(uid, onData, onError, 8) : null,
    [uid],
  );

  const { data: todaysMeals, loading: mealsLoading } = useFirestoreCollection<MealEntry>(
    uid ? (onData, onError) => mealsRepository.subscribeForUserByDate(uid, today, onData, onError) : null,
    [uid, today],
  );

  const { data: activeSupplements } = useFirestoreCollection<SupplementDefinition>(
    uid ? (onData, onError) => supplementsRepository.subscribeActiveForUser(uid, onData, onError) : null,
    [uid],
  );

  const { data: todaysSupplementLogs } = useFirestoreCollection<SupplementLog>(
    uid
      ? (onData, onError) => supplementLogsRepository.subscribeForUserByDate(uid, today, onData, onError)
      : null,
    [uid, today],
  );

  const { data: todaysWaterLogs } = useFirestoreCollection<WaterLogEntry>(
    uid ? (onData, onError) => waterLogsRepository.subscribeForUserByDate(uid, today, onData, onError) : null,
    [uid, today],
  );

  const { data: settings, loading: settingsLoading } = useFirestoreDoc<UserSettings>(
    uid ? (onData, onError) => settingsRepository.subscribeForUser(uid, onData, onError) : null,
    [uid],
  );

  const goals = {
    waterGoalMl: settings?.waterGoalMl ?? DEFAULT_GOALS.waterGoalMl,
    stepsGoal: settings?.stepsGoal ?? DEFAULT_GOALS.stepsGoal,
    proteinGoalG: settings?.proteinGoalG ?? DEFAULT_GOALS.proteinGoalG,
    calorieGoal: settings?.calorieGoal ?? DEFAULT_GOALS.calorieGoal,
  };

  const currentWeight = weights[0]?.weightKg ?? profile?.startWeightKg ?? 0;
  const goalWeight = profile?.goalWeightKg ?? 0;
  const startWeight = profile?.startWeightKg ?? currentWeight;
  const remaining = Math.max(currentWeight - goalWeight, 0);
  const totalToLose = Math.max(startWeight - goalWeight, 0);
  const weightProgressPercent = totalToLose > 0 ? ((startWeight - currentWeight) / totalToLose) * 100 : 0;
  const weightDelta = weights.length > 1 ? weights[0].weightKg - weights[1].weightKg : 0;

  const todaysCalories = todaysMeals.reduce((sum, m) => sum + m.macros.calories, 0);
  const todaysProtein = todaysMeals.reduce((sum, m) => sum + m.macros.proteinG, 0);
  const mealScores = todaysMeals.map((m) => m.score).filter((s): s is number => s != null);
  const avgMealScore = mealScores.length > 0 ? mealScores.reduce((a, b) => a + b, 0) / mealScores.length : null;

  const takenCount = todaysSupplementLogs.filter((l) => l.taken).length;
  const supplementScorePercent =
    activeSupplements.length > 0 ? (takenCount / activeSupplements.length) * 100 : 0;

  const todaysWaterMl = todaysWaterLogs.reduce((sum, entry) => sum + entry.amountMl, 0);

  const weeklyTrend = [...weights]
    .slice()
    .reverse()
    .map((w) => ({ label: formatDateLabel(w.date), value: w.weightKg }));

  const isLoading = weightsLoading || mealsLoading || settingsLoading;

  return (
    <div className="flex flex-col gap-6">
      <AICoachCard />

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Your numbers</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {goalWeight > 0
                ? `${formatWeightKg(remaining)} to go until your goal of ${formatWeightKg(goalWeight)}`
                : "Let's set up your goals in Settings."}
            </p>
          </div>

          <HealthRingsCard
            rings={[
              { label: "Protein", value: goals.proteinGoalG > 0 ? clampPercent((todaysProtein / goals.proteinGoalG) * 100) : 0, color: "var(--color-rose)" },
              { label: "Water", value: goals.waterGoalMl > 0 ? clampPercent((todaysWaterMl / goals.waterGoalMl) * 100) : 0, color: "var(--color-teal)" },
              { label: "Steps", value: 0, color: "var(--color-amber)" },
            ]}
          />

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard
              label="Current weight"
              value={currentWeight ? currentWeight.toFixed(1) : "—"}
              unit="kg"
              icon={<Scale size={18} />}
              tone="rose"
              trend={
                weights.length > 1
                  ? { label: formatDelta(weightDelta), direction: weightDelta < 0 ? "down" : weightDelta > 0 ? "up" : "flat" }
                  : undefined
              }
            />
            <StatCard
              label="Goal weight"
              value={goalWeight ? goalWeight.toFixed(1) : "—"}
              unit="kg"
              icon={<Target size={18} />}
              tone="teal"
            />
            <StatCard
              label="Weight remaining"
              value={remaining.toFixed(1)}
              unit="kg"
              icon={<Flame size={18} />}
              tone="amber"
              progressPercent={weightProgressPercent}
            />
            <StatCard
              label="Today's calories"
              value={formatCalories(todaysCalories).replace(" kcal", "")}
              unit="kcal"
              icon={<UtensilsCrossed size={18} />}
              tone="rose"
              progressPercent={goals.calorieGoal > 0 ? (todaysCalories / goals.calorieGoal) * 100 : 0}
            />
            <StatCard
              label="Protein progress"
              value={formatGrams(todaysProtein).replace(" g", "")}
              unit={`/ ${goals.proteinGoalG} g`}
              icon={<UtensilsCrossed size={18} />}
              tone="teal"
              progressPercent={goals.proteinGoalG > 0 ? (todaysProtein / goals.proteinGoalG) * 100 : 0}
            />
            <StatCard
              label="Water"
              value={(todaysWaterMl / 1000).toFixed(1)}
              unit={`/ ${(goals.waterGoalMl / 1000).toFixed(1)} L`}
              icon={<Droplets size={18} />}
              tone="teal"
              progressPercent={goals.waterGoalMl > 0 ? (todaysWaterMl / goals.waterGoalMl) * 100 : 0}
            />
            <StatCard
              label="Steps"
              value="0"
              unit={`/ ${goals.stepsGoal.toLocaleString("id-ID")}`}
              icon={<Footprints size={18} />}
              tone="amber"
              progressPercent={0}
            />
            <StatCard
              label="Meal score"
              value={avgMealScore != null ? Math.round(avgMealScore).toString() : "—"}
              unit="/ 100"
              icon={<UtensilsCrossed size={18} />}
              tone="rose"
              progressPercent={avgMealScore ?? 0}
            />
            <StatCard
              label="Supplement score"
              value={`${takenCount}/${activeSupplements.length}`}
              icon={<Pill size={18} />}
              tone="amber"
              progressPercent={supplementScorePercent}
            />
          </div>

          <WeeklyProgressCard data={weeklyTrend} />
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-40 w-full rounded-card" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-card" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-card" />
    </div>
  );
}
