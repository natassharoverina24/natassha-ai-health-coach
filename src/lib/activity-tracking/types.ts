import type {
  WorkoutActivityType,
  WorkoutCalorieEstimateAudit,
  WorkoutIntensity,
} from "@/types/firestore";

export interface WorkoutEstimateInput {
  activityType: WorkoutActivityType;
  durationMin: number;
  intensity: WorkoutIntensity;
  weightKg: number | null;
}

export type WorkoutCalorieEstimateResult =
  | {
      status: "success";
      caloriesKcal: number;
      met: number;
      assumptions: string[];
    }
  | {
      status: "partial";
      reason: "missing-weight" | "custom-activity";
      caloriesKcal: null;
      met: number | null;
      assumptions: string[];
    }
  | {
      status: "invalid-input";
      reason: "invalid-duration" | "invalid-weight";
      caloriesKcal: null;
      met: null;
      assumptions: string[];
    };

export interface ConfirmedWorkoutLogInput {
  name: string;
  activityType: WorkoutActivityType;
  durationMin: number;
  intensity: WorkoutIntensity;
  distanceKm: number | null;
  speedKph: number | null;
  caloriesBurnedKcal: number;
  calorieEstimate: WorkoutCalorieEstimateAudit;
}

export interface ConfirmedSleepLogInput {
  sleepAt: string;
  wakeAt: string;
  hoursSlept: number;
  quality: "poor" | "okay" | "good" | null;
}

export type SleepDurationResult =
  | { status: "success"; durationMinutes: number; hoursSlept: number }
  | { status: "invalid-input"; reason: "invalid-clock" | "same-time" };
