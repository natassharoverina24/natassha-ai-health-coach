/**
 * Firestore Data Model
 * ---------------------------------------------------------------------------
 * Single source of truth for every document shape stored in Cloud Firestore.
 * Keep this file framework-agnostic: no React, no Firebase SDK imports here,
 * only plain TypeScript types. Repositories (src/lib/db) map raw Firestore
 * snapshots onto these types; UI components should never talk to Firestore
 * directly, only through repositories and hooks.
 */

/** Firestore Timestamps are stored as ISO-8601 strings once they reach the UI layer. */
export type ISODateString = string;

/** Every document carries these two fields, stamped by the repository layer. */
export interface BaseDocument {
  id: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// users
// -----------------------------------------------------------------------------

export type UnitSystem = "metric" | "imperial";
export type AppTheme = "light" | "dark" | "system";

export interface UserProfile extends BaseDocument {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  country: string;
  heightCm: number;
  startWeightKg: number;
  goalWeightKg: number;
  dateOfBirth: ISODateString | null;
  sex: "female" | "male" | "unspecified";
  leaveHomeTime: string; // "HH:mm"
  arriveHomeTime: string; // "HH:mm"
  lunchProvidedByOffice: boolean;
  unitSystem: UnitSystem;
  onboardingCompleted: boolean;
}

// -----------------------------------------------------------------------------
// weights
// -----------------------------------------------------------------------------

export interface WeightEntry extends BaseDocument {
  userId: string;
  date: ISODateString;
  weightKg: number;
  bodyFatPercent: number | null;
  muscleMassKg: number | null;
  note: string | null;
  source: "manual" | "smart-scale" | "import";
}

// -----------------------------------------------------------------------------
// waists
// -----------------------------------------------------------------------------

export interface WaistEntry extends BaseDocument {
  userId: string;
  date: ISODateString;
  waistCm: number;
  hipCm: number | null;
  chestCm: number | null;
  note: string | null;
}

// -----------------------------------------------------------------------------
// meals
// -----------------------------------------------------------------------------

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealMacro {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
}

export interface MealNutritionMacro {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export type MealNutritionEstimateSource =
  | "local-approved"
  | "gemini-estimate"
  | "manual-entry";

export interface MealNutritionConfirmation {
  status: "confirmed";
  source: MealNutritionEstimateSource;
  userConfirmed: true;
  servingGrams: number | null;
  assumptions: string[];
  estimatedAt: ISODateString | null;
  confirmedAt: ISODateString;
}

export interface MealEntry extends BaseDocument {
  userId: string;
  date: ISODateString;
  type: MealType;
  name: string;
  quantity: string | null;
  isOfficeLunch: boolean;
  macros: MealMacro;
  nutritionConfirmation?: MealNutritionConfirmation;
  photoIds: string[];
  photoEstimate?: {
    source: "photo-estimate";
    userConfirmed: true;
    estimatedAt: ISODateString;
  };
  score: number | null; // 0-100 adherence score, computed by business logic later
  note: string | null;
}

// -----------------------------------------------------------------------------
// water_logs
// -----------------------------------------------------------------------------

/**
 * One entry per water log-tap (Phase 2A: Meal Tracking → Water Tracker).
 * Modeled the same way as `supplement_logs`: small, timestamped, per-day
 * quantity entries under their own collection, rather than a field on
 * `meals` (water isn't food) or `settings` (settings is preferences, not
 * a date-partitioned log — it already holds the *goal*, `waterGoalMl`).
 */
export interface WaterLogEntry extends BaseDocument {
  userId: string;
  date: ISODateString;
  amountMl: number;
  loggedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// timeline_completions
// -----------------------------------------------------------------------------

/**
 * Manual completion for a non-loggable timeline item. Meal, water, and
 * workout completion must continue to come from their dedicated log
 * collections and must never be duplicated here.
 */
export interface TimelineCompletionEntry extends BaseDocument {
  userId: string;
  date: ISODateString;
  itemId: string;
  completedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// workouts
// -----------------------------------------------------------------------------

/**
 * A logged workout session (Phase 2C: Weekly Progress & Coach Dashboard).
 * Kept deliberately minimal — this app doesn't have a full workout-planning
 * feature yet, just enough to log "I worked out today" for adherence
 * tracking and milestones. Same small-log-collection pattern as
 * `water_logs` / `supplement_logs`.
 */
export interface WorkoutEntry extends BaseDocument {
  userId: string;
  date: ISODateString;
  name: string;
  durationMin: number;
  note: string | null;
}

// -----------------------------------------------------------------------------
// sleep_logs
// -----------------------------------------------------------------------------

export interface SleepEntry extends BaseDocument {
  userId: string;
  date: ISODateString;
  hoursSlept: number;
  note: string | null;
}

// -----------------------------------------------------------------------------
// motivations
// -----------------------------------------------------------------------------

/**
 * Long-term "why" statements the WHY Engine draws on (Phase 3: Adaptive AI
 * Coach Core) — e.g. "I want to keep up with my kids", "I want to feel
 * confident in my clothes again". `lastReferencedAt` lets the engine rotate
 * through them and avoid repeating the same one too often, rather than
 * cramming reference-history into `users` (a stable profile doc) or
 * `ai_logs` (an append-only transcript, awkward to query "when did we last
 * mention motivation X").
 */
export interface MotivationEntry extends BaseDocument {
  userId: string;
  text: string;
  active: boolean;
  lastReferencedAt: ISODateString | null;
}

// -----------------------------------------------------------------------------
// supplements
// -----------------------------------------------------------------------------

export type SupplementFrequency = "daily" | "weekdays" | "custom";

export interface SupplementDefinition extends BaseDocument {
  userId: string;
  name: string;
  dosage: string;
  frequency: SupplementFrequency;
  timesOfDay: string[]; // ["07:00", "19:30"]
  active: boolean;
}

export interface SupplementLog extends BaseDocument {
  userId: string;
  supplementId: string;
  date: ISODateString;
  taken: boolean;
  takenAt: ISODateString | null;
}

// -----------------------------------------------------------------------------
// shopping
// -----------------------------------------------------------------------------

export type ShoppingCategory =
  | "protein"
  | "produce"
  | "pantry"
  | "dairy"
  | "supplements"
  | "other";

export interface ShoppingItem extends BaseDocument {
  userId: string;
  name: string;
  category: ShoppingCategory;
  quantity: string | null;
  checked: boolean;
  addedFrom: "manual" | "ai-suggestion" | "recurring";
}

// -----------------------------------------------------------------------------
// reports
// -----------------------------------------------------------------------------

export type ReportPeriod = "weekly" | "monthly";

export interface ReportSummary extends BaseDocument {
  userId: string;
  period: ReportPeriod;
  startDate: ISODateString;
  endDate: ISODateString;
  avgWeightKg: number | null;
  weightDeltaKg: number | null;
  avgCalories: number | null;
  avgProteinG: number | null;
  mealScoreAvg: number | null;
  supplementAdherencePercent: number | null;
  storagePath: string | null; // optional generated PDF/export
  generatedBy: "system" | "ai" | "manual";
}

// -----------------------------------------------------------------------------
// cycles
// -----------------------------------------------------------------------------

/** Menstrual / hormonal cycle tracking — informs coaching later, not implemented yet. */
export interface CycleEntry extends BaseDocument {
  userId: string;
  startDate: ISODateString;
  endDate: ISODateString | null;
  symptoms: string[];
  note: string | null;
}

// -----------------------------------------------------------------------------
// settings
// -----------------------------------------------------------------------------

export interface NotificationPrefs {
  mealReminders: boolean;
  weighInReminder: boolean;
  supplementReminders: boolean;
  waterReminders: boolean;
  weeklyReportReady: boolean;
}

export interface UserSettings extends BaseDocument {
  userId: string;
  theme: AppTheme;
  unitSystem: UnitSystem;
  notifications: NotificationPrefs;
  waterGoalMl: number;
  stepsGoal: number;
  proteinGoalG: number;
  calorieGoal: number;
  workoutGoalMinPerDay: number;
  sleepGoalHours: number;
  fcmTokens: string[];
}

// -----------------------------------------------------------------------------
// ai_logs
// -----------------------------------------------------------------------------

export type AILogRole = "user" | "assistant" | "system";

export interface AILogEntry extends BaseDocument {
  userId: string;
  role: AILogRole;
  content: string;
  contextSnapshotId: string | null;
  tokensUsed: number | null;
  model: string | null;
}

// -----------------------------------------------------------------------------
// Collection name constants — single source of truth to avoid typos.
// -----------------------------------------------------------------------------

export const COLLECTIONS = {
  users: "users",
  weights: "weights",
  waists: "waists",
  meals: "meals",
  supplements: "supplements",
  supplementLogs: "supplement_logs",
  waterLogs: "water_logs",
  timelineCompletions: "timeline_completions",
  workouts: "workouts",
  sleepLogs: "sleep_logs",
  motivations: "motivations",
  shopping: "shopping",
  reports: "reports",
  cycles: "cycles",
  settings: "settings",
  aiLogs: "ai_logs",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
