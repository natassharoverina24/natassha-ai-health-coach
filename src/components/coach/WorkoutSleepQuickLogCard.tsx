"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Dumbbell, Moon } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { SleepEntry, WorkoutEntry } from "@/types/firestore";

export interface WorkoutSleepQuickLogCardProps {
  todaysWorkouts: WorkoutEntry[];
  todaysSleep: SleepEntry | null;
  onLogWorkout: (name: string, durationMin: number) => Promise<void>;
  onLogSleep: (hoursSlept: number) => Promise<void>;
}

/**
 * Minimal same-day logging for the two dimensions the Coach Score needs
 * but this app has no dedicated tracking page for yet (workout, sleep).
 * Deliberately small — one workout field, one sleep field — rather than a
 * full workout/sleep feature, which is out of scope for this phase.
 */
export function WorkoutSleepQuickLogCard({
  todaysWorkouts,
  todaysSleep,
  onLogWorkout,
  onLogSleep,
}: WorkoutSleepQuickLogCardProps) {
  const [workoutName, setWorkoutName] = useState("");
  const [workoutMinutes, setWorkoutMinutes] = useState("");
  const [sleepHours, setSleepHours] = useState(todaysSleep?.hoursSlept?.toString() ?? "");
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [savingSleep, setSavingSleep] = useState(false);

  const totalWorkoutMinutesToday = todaysWorkouts.reduce((sum, w) => sum + w.durationMin, 0);

  const handleLogWorkout = async (e: FormEvent) => {
    e.preventDefault();
    const minutes = parseFloat(workoutMinutes);
    if (!workoutName.trim() || !Number.isFinite(minutes) || minutes <= 0) return;
    setSavingWorkout(true);
    try {
      await onLogWorkout(workoutName.trim(), minutes);
      setWorkoutName("");
      setWorkoutMinutes("");
    } finally {
      setSavingWorkout(false);
    }
  };

  const handleLogSleep = async (e: FormEvent) => {
    e.preventDefault();
    const hours = parseFloat(sleepHours);
    if (!Number.isFinite(hours) || hours <= 0) return;
    setSavingSleep(true);
    try {
      await onLogSleep(hours);
    } finally {
      setSavingSleep(false);
    }
  };

  return (
    <GlassCard className="flex flex-col gap-5 sm:flex-row sm:gap-8">
      <form onSubmit={handleLogWorkout} className="flex flex-1 flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-soft text-amber">
            <Dumbbell size={14} />
          </span>
          <p className="text-sm font-semibold text-ink">Today&apos;s workout</p>
          {totalWorkoutMinutesToday > 0 && <Badge tone="amber">{totalWorkoutMinutesToday} min logged</Badge>}
        </div>
        <div className="flex gap-2">
          <Input
            name="workoutName"
            placeholder="e.g. Brisk walk"
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            className="flex-[2]"
          />
          <Input
            name="workoutMinutes"
            type="number"
            inputMode="decimal"
            placeholder="min"
            value={workoutMinutes}
            onChange={(e) => setWorkoutMinutes(e.target.value)}
            className="flex-1"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" isLoading={savingWorkout} className="self-start">
          Log workout
        </Button>
      </form>

      <form onSubmit={handleLogSleep} className="flex flex-1 flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-taupe-soft text-rose-strong">
            <Moon size={14} />
          </span>
          <p className="text-sm font-semibold text-ink">Last night&apos;s sleep</p>
          {todaysSleep && <Badge tone="taupe">{todaysSleep.hoursSlept}h logged</Badge>}
        </div>
        <Input
          name="sleepHours"
          type="number"
          inputMode="decimal"
          label="Hours slept"
          suffix="hrs"
          value={sleepHours}
          onChange={(e) => setSleepHours(e.target.value)}
        />
        <Button type="submit" size="sm" variant="secondary" isLoading={savingSleep} className="self-start">
          {todaysSleep ? "Update" : "Log sleep"}
        </Button>
      </form>
    </GlassCard>
  );
}
