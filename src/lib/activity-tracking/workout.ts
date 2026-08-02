import type {
  WorkoutActivityType,
  WorkoutIntensity,
} from "@/types/firestore";
import type {
  WorkoutCalorieEstimateResult,
  WorkoutEstimateInput,
} from "./types";

const MET_BY_ACTIVITY: Readonly<
  Record<Exclude<WorkoutActivityType, "other">, Readonly<Record<WorkoutIntensity, number>>>
> = {
  treadmill: { light: 4, moderate: 6, vigorous: 8 },
  walking: { light: 3, moderate: 4, vigorous: 5 },
  running: { light: 6, moderate: 8, vigorous: 10 },
  cycling: { light: 4, moderate: 6, vigorous: 8 },
  "strength-training": { light: 3.5, moderate: 5, vigorous: 6 },
  "yoga-stretching": { light: 2.5, moderate: 3, vigorous: 4 },
};

export const WORKOUT_ACTIVITY_LABELS: Readonly<Record<WorkoutActivityType, string>> = {
  treadmill: "Treadmill",
  walking: "Jalan kaki",
  running: "Lari",
  cycling: "Bersepeda",
  "strength-training": "Latihan kekuatan",
  "yoga-stretching": "Yoga / stretching",
  other: "Lainnya",
};

export function classifyWorkoutActivity(name: string): WorkoutActivityType {
  const normalized = name.trim().toLowerCase();
  if (/treadmill/.test(normalized)) return "treadmill";
  if (/jalan|walk/.test(normalized)) return "walking";
  if (/lari|run|jog/.test(normalized)) return "running";
  if (/sepeda|cycling|bike/.test(normalized)) return "cycling";
  if (/strength|angkat beban|weight training|gym/.test(normalized)) return "strength-training";
  if (/yoga|stretch/.test(normalized)) return "yoga-stretching";
  return "other";
}

export function estimateWorkoutCalories(
  input: WorkoutEstimateInput,
): WorkoutCalorieEstimateResult {
  if (!Number.isFinite(input.durationMin) || input.durationMin <= 0) {
    return {
      status: "invalid-input",
      reason: "invalid-duration",
      caloriesKcal: null,
      met: null,
      assumptions: [],
    };
  }
  if (input.activityType === "other") {
    return {
      status: "partial",
      reason: "custom-activity",
      caloriesKcal: null,
      met: null,
      assumptions: ["Jenis aktivitas custom perlu angka kalori yang kamu konfirmasi."],
    };
  }
  if (input.weightKg === null) {
    return {
      status: "partial",
      reason: "missing-weight",
      caloriesKcal: null,
      met: MET_BY_ACTIVITY[input.activityType][input.intensity],
      assumptions: ["Berat badan belum tersedia, jadi estimasi otomatis belum dihitung."],
    };
  }
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    return {
      status: "invalid-input",
      reason: "invalid-weight",
      caloriesKcal: null,
      met: null,
      assumptions: [],
    };
  }

  const met = MET_BY_ACTIVITY[input.activityType][input.intensity];
  const caloriesKcal = Math.round(
    (met * 3.5 * input.weightKg * input.durationMin) / 200,
  );
  return {
    status: "success",
    caloriesKcal,
    met,
    assumptions: [
      `Estimasi lokal memakai MET ${met}, durasi ${input.durationMin} menit, dan berat ${input.weightKg} kg.`,
    ],
  };
}
