"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { LogOut, Moon, Sun, SunMoon } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFirestoreDoc } from "@/hooks";
import { usersRepository } from "@/lib/db/users.repository";
import { settingsRepository } from "@/lib/db/settings.repository";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { DEFAULT_GOALS } from "@/lib/utils/constants";
import { cn } from "@/lib/utils/cn";
import type { AppTheme, UserSettings } from "@/types/firestore";

const THEME_OPTIONS: { value: AppTheme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: SunMoon },
];

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const uid = user?.uid ?? null;

  const { data: settings } = useFirestoreDoc<UserSettings>(
    uid ? (onData, onError) => settingsRepository.subscribeForUser(uid, onData, onError) : null,
    [uid],
  );

  const [form, setForm] = useState({
    displayName: "",
    heightCm: "",
    goalWeightKg: "",
    leaveHomeTime: "",
    arriveHomeTime: "",
    lunchProvidedByOffice: true,
  });
  const [goalsForm, setGoalsForm] = useState({
    calorieGoal: DEFAULT_GOALS.calorieGoal.toString(),
    proteinGoalG: DEFAULT_GOALS.proteinGoalG.toString(),
    waterGoalMl: DEFAULT_GOALS.waterGoalMl.toString(),
    stepsGoal: DEFAULT_GOALS.stepsGoal.toString(),
    workoutGoalMinPerDay: DEFAULT_GOALS.workoutGoalMinPerDay.toString(),
    sleepGoalHours: DEFAULT_GOALS.sleepGoalHours.toString(),
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Seed the editable form once per loaded document, not on every snapshot —
  // this is React's documented "adjusting state during render" pattern
  // (https://react.dev/learn/you-might-not-need-an-effect), not an effect,
  // so it also avoids the bug the previous effect-based version had: it
  // would silently blow away in-progress edits every time Firestore pushed
  // an unrelated snapshot update for the same document.
  const [profileSeededFor, setProfileSeededFor] = useState<string | null>(null);
  if (profile && profile.id !== profileSeededFor) {
    setProfileSeededFor(profile.id);
    setForm({
      displayName: profile.displayName,
      heightCm: profile.heightCm.toString(),
      goalWeightKg: profile.goalWeightKg.toString(),
      leaveHomeTime: profile.leaveHomeTime,
      arriveHomeTime: profile.arriveHomeTime,
      lunchProvidedByOffice: profile.lunchProvidedByOffice,
    });
  }

  const [goalsSeededFor, setGoalsSeededFor] = useState<string | null>(null);
  if (settings && settings.id !== goalsSeededFor) {
    setGoalsSeededFor(settings.id);
    setGoalsForm({
      calorieGoal: settings.calorieGoal.toString(),
      proteinGoalG: settings.proteinGoalG.toString(),
      waterGoalMl: settings.waterGoalMl.toString(),
      stepsGoal: settings.stepsGoal.toString(),
      workoutGoalMinPerDay: settings.workoutGoalMinPerDay.toString(),
      sleepGoalHours: settings.sleepGoalHours.toString(),
    });
  }

  const flashSaved = (msg: string) => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(null), 2500);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    setSavingProfile(true);
    try {
      await usersRepository.updateProfile(uid, {
        displayName: form.displayName,
        heightCm: parseFloat(form.heightCm) || 0,
        goalWeightKg: parseFloat(form.goalWeightKg) || 0,
        leaveHomeTime: form.leaveHomeTime,
        arriveHomeTime: form.arriveHomeTime,
        lunchProvidedByOffice: form.lunchProvidedByOffice,
        onboardingCompleted: true,
      });
      flashSaved("Profile saved");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveGoals = async (e: FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    setSavingGoals(true);
    try {
      const payload = {
        theme: settings?.theme ?? "system" as AppTheme,
        unitSystem: settings?.unitSystem ?? ("metric" as const),
        notifications: settings?.notifications ?? {
          mealReminders: true,
          weighInReminder: true,
          supplementReminders: true,
          waterReminders: true,
          weeklyReportReady: true,
        },
        calorieGoal: parseFloat(goalsForm.calorieGoal) || DEFAULT_GOALS.calorieGoal,
        proteinGoalG: parseFloat(goalsForm.proteinGoalG) || DEFAULT_GOALS.proteinGoalG,
        waterGoalMl: parseFloat(goalsForm.waterGoalMl) || DEFAULT_GOALS.waterGoalMl,
        stepsGoal: parseFloat(goalsForm.stepsGoal) || DEFAULT_GOALS.stepsGoal,
        workoutGoalMinPerDay:
          parseFloat(goalsForm.workoutGoalMinPerDay) || DEFAULT_GOALS.workoutGoalMinPerDay,
        sleepGoalHours: parseFloat(goalsForm.sleepGoalHours) || DEFAULT_GOALS.sleepGoalHours,
        fcmTokens: settings?.fcmTokens ?? [],
      };
      if (settings) {
        await settingsRepository.updateForUser(uid, payload);
      } else {
        await settingsRepository.upsert(uid, payload);
      }
      flashSaved("Goals saved");
    } finally {
      setSavingGoals(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Your profile, daily goals, and app preferences." />

      {profile && (
        <GlassCard className="flex items-center gap-4">
          <Avatar name={profile.displayName} src={profile.photoURL} size={56} />
          <div>
            <p className="font-semibold text-ink">{profile.displayName}</p>
            <p className="text-sm text-ink-muted">{profile.email}</p>
          </div>
        </GlassCard>
      )}

      <GlassCard className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-ink">Appearance</p>
        <div className="flex gap-2">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = theme === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1.5 rounded-control border py-3 text-xs font-medium transition-colors",
                  active ? "border-rose bg-petal-soft text-rose-strong" : "border-ink/10 text-ink-muted",
                )}
              >
                <Icon size={18} />
                {option.label}
              </button>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard>
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-ink">Profile</p>
          <Input
            label="Name"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="Height"
              suffix="cm"
              value={form.heightCm}
              onChange={(e) => setForm((f) => ({ ...f, heightCm: e.target.value }))}
            />
            <Input
              type="number"
              label="Goal weight"
              suffix="kg"
              value={form.goalWeightKg}
              onChange={(e) => setForm((f) => ({ ...f, goalWeightKg: e.target.value }))}
            />
            <Input
              type="time"
              label="Leave home"
              value={form.leaveHomeTime}
              onChange={(e) => setForm((f) => ({ ...f, leaveHomeTime: e.target.value }))}
            />
            <Input
              type="time"
              label="Arrive home"
              value={form.arriveHomeTime}
              onChange={(e) => setForm((f) => ({ ...f, arriveHomeTime: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={form.lunchProvidedByOffice}
              onChange={(e) => setForm((f) => ({ ...f, lunchProvidedByOffice: e.target.checked }))}
              className="h-4 w-4 rounded accent-[var(--color-rose)]"
            />
            Lunch is provided by my office
          </label>
          <Button type="submit" isLoading={savingProfile} className="self-start">
            Save profile
          </Button>
        </form>
      </GlassCard>

      <GlassCard>
        <form onSubmit={handleSaveGoals} className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-ink">Daily goals</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="Calorie goal"
              suffix="kcal"
              value={goalsForm.calorieGoal}
              onChange={(e) => setGoalsForm((f) => ({ ...f, calorieGoal: e.target.value }))}
            />
            <Input
              type="number"
              label="Protein goal"
              suffix="g"
              value={goalsForm.proteinGoalG}
              onChange={(e) => setGoalsForm((f) => ({ ...f, proteinGoalG: e.target.value }))}
            />
            <Input
              type="number"
              label="Water goal"
              suffix="ml"
              value={goalsForm.waterGoalMl}
              onChange={(e) => setGoalsForm((f) => ({ ...f, waterGoalMl: e.target.value }))}
            />
            <Input
              type="number"
              label="Steps goal"
              value={goalsForm.stepsGoal}
              onChange={(e) => setGoalsForm((f) => ({ ...f, stepsGoal: e.target.value }))}
            />
            <Input
              type="number"
              label="Workout goal"
              suffix="min/day"
              value={goalsForm.workoutGoalMinPerDay}
              onChange={(e) => setGoalsForm((f) => ({ ...f, workoutGoalMinPerDay: e.target.value }))}
            />
            <Input
              type="number"
              label="Sleep goal"
              suffix="hours"
              value={goalsForm.sleepGoalHours}
              onChange={(e) => setGoalsForm((f) => ({ ...f, sleepGoalHours: e.target.value }))}
            />
          </div>
          <Button type="submit" isLoading={savingGoals} className="self-start">
            Save goals
          </Button>
        </form>
      </GlassCard>

      {savedMessage && (
        <p role="status" className="text-sm font-medium text-success">
          {savedMessage}
        </p>
      )}

      <Button
        variant="outline"
        leadingIcon={<LogOut size={16} />}
        onClick={() => void signOut()}
        className="self-start"
      >
        Sign out
      </Button>
    </div>
  );
}
