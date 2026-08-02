"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Dumbbell, Moon } from "lucide-react";

import {
  buildSleepInsight,
  calculateSleepDuration,
  estimateWorkoutCalories,
  WORKOUT_ACTIVITY_LABELS,
} from "@/lib/activity-tracking";
import type {
  ConfirmedSleepLogInput,
  ConfirmedWorkoutLogInput,
} from "@/lib/activity-tracking";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type {
  SleepEntry,
  WorkoutActivityType,
  WorkoutEntry,
  WorkoutIntensity,
} from "@/types/firestore";

export interface WorkoutSleepQuickLogCardProps {
  todaysWorkouts: WorkoutEntry[];
  todaysSleep: SleepEntry | null;
  userWeightKg: number | null;
  onLogWorkout: (input: ConfirmedWorkoutLogInput) => Promise<void>;
  onLogSleep: (input: ConfirmedSleepLogInput) => Promise<void>;
}

const selectClassName =
  "h-12 w-full rounded-control border border-ink/10 bg-bg-elevated px-3 text-sm text-ink focus:border-rose";

export function WorkoutSleepQuickLogCard({
  todaysWorkouts,
  todaysSleep,
  userWeightKg,
  onLogWorkout,
  onLogSleep,
}: WorkoutSleepQuickLogCardProps) {
  const [activityType, setActivityType] =
    useState<WorkoutActivityType>("treadmill");
  const [customName, setCustomName] = useState("");
  const [workoutMinutes, setWorkoutMinutes] = useState("");
  const [intensity, setIntensity] =
    useState<WorkoutIntensity>("moderate");
  const [distanceKm, setDistanceKm] = useState("");
  const [speedKph, setSpeedKph] = useState("");
  const [workoutCalories, setWorkoutCalories] = useState("");
  const [caloriesEdited, setCaloriesEdited] = useState(false);
  const [sleepAt, setSleepAt] = useState(todaysSleep?.sleepAt ?? "");
  const [wakeAt, setWakeAt] = useState(todaysSleep?.wakeAt ?? "");
  const [sleepQuality, setSleepQuality] = useState<"" | "poor" | "okay" | "good">(
    todaysSleep?.quality ?? "",
  );
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [savingSleep, setSavingSleep] = useState(false);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [sleepError, setSleepError] = useState<string | null>(null);

  const durationMin = Number(workoutMinutes);
  const calorieEstimate = useMemo(
    () =>
      estimateWorkoutCalories({
        activityType,
        durationMin,
        intensity,
        weightKg: userWeightKg,
      }),
    [activityType, durationMin, intensity, userWeightKg],
  );
  const displayedWorkoutCalories = caloriesEdited
    ? workoutCalories
    : calorieEstimate.status === "success"
      ? String(calorieEstimate.caloriesKcal)
      : workoutCalories;
  const confirmedCalories = Number(displayedWorkoutCalories);
  const sleepDuration = useMemo(
    () => calculateSleepDuration(sleepAt, wakeAt),
    [sleepAt, wakeAt],
  );
  const totalWorkoutMinutesToday = todaysWorkouts.reduce(
    (sum, workout) => sum + workout.durationMin,
    0,
  );

  const handleLogWorkout = async (event: FormEvent) => {
    event.preventDefault();
    const name =
      activityType === "other"
        ? customName.trim()
        : WORKOUT_ACTIVITY_LABELS[activityType];
    if (
      !name ||
      !Number.isFinite(durationMin) ||
      durationMin <= 0 ||
      !Number.isFinite(confirmedCalories) ||
      confirmedCalories <= 0
    ) {
      return;
    }
    setSavingWorkout(true);
    setWorkoutError(null);
    try {
      const estimatedCaloriesKcal =
        calorieEstimate.status === "success"
          ? calorieEstimate.caloriesKcal
          : null;
      await onLogWorkout({
        name,
        activityType,
        durationMin,
        intensity,
        distanceKm: positiveNumberOrNull(distanceKm),
        speedKph: positiveNumberOrNull(speedKph),
        caloriesBurnedKcal: confirmedCalories,
        calorieEstimate: {
          method: "met-local",
          estimatedCaloriesKcal,
          confirmedCaloriesKcal: confirmedCalories,
          met: calorieEstimate.met,
          weightKgUsed: userWeightKg,
          userConfirmed: true,
          wasEdited:
            estimatedCaloriesKcal === null ||
            confirmedCalories !== estimatedCaloriesKcal,
          assumptions: [...calorieEstimate.assumptions],
          estimatedAt: new Date().toISOString(),
        },
      });
      setWorkoutMinutes("");
      setDistanceKm("");
      setSpeedKph("");
      setWorkoutCalories("");
      setCaloriesEdited(false);
      setCustomName("");
    } catch {
      setWorkoutError("Workout-nya belum berhasil disimpan. Coba lagi ya.");
    } finally {
      setSavingWorkout(false);
    }
  };

  const handleLogSleep = async (event: FormEvent) => {
    event.preventDefault();
    if (sleepDuration.status !== "success") return;
    setSavingSleep(true);
    setSleepError(null);
    try {
      await onLogSleep({
        sleepAt,
        wakeAt,
        hoursSlept: sleepDuration.hoursSlept,
        quality: sleepQuality || null,
      });
    } catch {
      setSleepError("Catatan tidurnya belum berhasil disimpan. Coba lagi ya.");
    } finally {
      setSavingSleep(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <GlassCard>
        <section aria-labelledby="workout-log-heading">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-petal-soft text-rose-strong">
              <Dumbbell size={16} />
            </span>
            <div>
              <h2 id="workout-log-heading" className="text-sm font-semibold text-ink">
                Progress workout
              </h2>
              <p className="text-xs text-ink-muted">Catat aktivitasnya terpisah dari tidur.</p>
            </div>
            {totalWorkoutMinutesToday > 0 && (
              <Badge tone="rose">{totalWorkoutMinutesToday} menit</Badge>
            )}
          </div>

          <form onSubmit={handleLogWorkout} className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-sm font-medium text-ink" htmlFor="workoutActivityType">
              Aktivitas
              <select
                id="workoutActivityType"
                name="workoutActivityType"
                className={selectClassName}
                value={activityType}
                onChange={(event) => {
                  setActivityType(event.target.value as WorkoutActivityType);
                  setCaloriesEdited(false);
                  setWorkoutCalories("");
                }}
              >
                {Object.entries(WORKOUT_ACTIVITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            {activityType === "other" && (
              <Input
                name="customWorkoutName"
                label="Nama aktivitas"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <Input
                name="workoutMinutes"
                type="number"
                min="1"
                inputMode="decimal"
                label="Durasi"
                suffix="menit"
                value={workoutMinutes}
                onChange={(event) => {
                  setWorkoutMinutes(event.target.value);
                  setCaloriesEdited(false);
                  setWorkoutCalories("");
                }}
              />
              <label className="grid gap-1.5 text-sm font-medium text-ink" htmlFor="workoutIntensity">
                Intensitas
                <select
                  id="workoutIntensity"
                  name="workoutIntensity"
                  className={selectClassName}
                  value={intensity}
                  onChange={(event) => {
                    setIntensity(event.target.value as WorkoutIntensity);
                    setCaloriesEdited(false);
                    setWorkoutCalories("");
                  }}
                >
                  <option value="light">Ringan</option>
                  <option value="moderate">Sedang</option>
                  <option value="vigorous">Tinggi</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input name="distanceKm" type="number" min="0" step="0.1" label="Jarak (opsional)" suffix="km" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} />
              <Input name="speedKph" type="number" min="0" step="0.1" label="Kecepatan (opsional)" suffix="km/j" value={speedKph} onChange={(event) => setSpeedKph(event.target.value)} />
            </div>
            <Input
              name="workoutCalories"
              type="number"
              min="1"
              inputMode="decimal"
              label="Kalori olahraga"
              suffix="kcal"
              value={displayedWorkoutCalories}
              onChange={(event) => {
                setCaloriesEdited(true);
                setWorkoutCalories(event.target.value);
              }}
              hint="Kalori olahraga ini estimasi ya 💗 Kamu bisa edit kalau angka dari alat/watch beda."
            />
            {calorieEstimate.status === "success" && (
              <p className="text-xs text-ink-muted">
                {calorieEstimate.assumptions[0]}
              </p>
            )}
            {calorieEstimate.status === "partial" && (
              <p role="status" className="rounded-control bg-petal-soft px-3 py-2 text-xs text-ink">
                {calorieEstimate.reason === "missing-weight"
                  ? "Berat badan belum tersedia, jadi isi atau konfirmasi kalori secara manual ya."
                  : "Aktivitas custom perlu angka kalori yang kamu konfirmasi."}
              </p>
            )}
            {workoutError && <p role="alert" className="text-xs text-danger">{workoutError}</p>}
            <Button
              type="submit"
              size="sm"
              isLoading={savingWorkout}
              disabled={!Number.isFinite(confirmedCalories) || confirmedCalories <= 0}
              className="w-full sm:w-auto"
            >
              Simpan workout
            </Button>
          </form>
        </section>
      </GlassCard>

      <GlassCard>
        <section aria-labelledby="sleep-log-heading">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-taupe-soft text-rose-strong">
              <Moon size={16} />
            </span>
            <div>
              <h2 id="sleep-log-heading" className="text-sm font-semibold text-ink">
                Progress tidur
              </h2>
              <p className="text-xs text-ink-muted">Jam tidur dan bangun dihitung otomatis.</p>
            </div>
            {todaysSleep && <Badge tone="taupe">{todaysSleep.hoursSlept} jam</Badge>}
          </div>

          <form onSubmit={handleLogSleep} className="mt-4 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Input name="sleepAt" type="time" label="Jam tidur" value={sleepAt} onChange={(event) => setSleepAt(event.target.value)} />
              <Input name="wakeAt" type="time" label="Jam bangun" value={wakeAt} onChange={(event) => setWakeAt(event.target.value)} />
            </div>
            <label className="grid gap-1.5 text-sm font-medium text-ink" htmlFor="sleepQuality">
              Kualitas tidur (opsional)
              <select id="sleepQuality" name="sleepQuality" className={selectClassName} value={sleepQuality} onChange={(event) => setSleepQuality(event.target.value as typeof sleepQuality)}>
                <option value="">Belum dipilih</option>
                <option value="poor">Kurang nyaman</option>
                <option value="okay">Lumayan</option>
                <option value="good">Nyaman</option>
              </select>
            </label>
            {sleepDuration.status === "success" && (
              <div role="status" className="rounded-control bg-petal-soft px-3 py-2 text-xs text-ink">
                {buildSleepInsight(sleepDuration.durationMinutes).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
            {sleepDuration.status === "invalid-input" && sleepAt && wakeAt && (
              <p role="alert" className="text-xs text-danger">
                Jam tidur dan bangun perlu berbeda ya.
              </p>
            )}
            {todaysSleep && !todaysSleep.sleepAt && (
              <p className="text-xs text-ink-muted">
                Catatan lama: {todaysSleep.hoursSlept} jam. Isi waktunya untuk memperbarui detail.
              </p>
            )}
            {sleepError && <p role="alert" className="text-xs text-danger">{sleepError}</p>}
            <Button
              type="submit"
              size="sm"
              isLoading={savingSleep}
              disabled={sleepDuration.status !== "success"}
              className="w-full sm:w-auto"
            >
              {todaysSleep ? "Perbarui tidur" : "Simpan tidur"}
            </Button>
          </form>
        </section>
      </GlassCard>
    </div>
  );
}

function positiveNumberOrNull(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
