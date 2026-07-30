import type { CoachDecision } from "@/lib/engines/decisionEngine";
import type {
  AdaptiveAdjustmentResult,
  ApprovedIngredientCatalogue,
  DailyTargets,
  EmergencyDisruption,
  EmergencyPlanResult,
  InsightSummary,
  MealRecommendation,
  MealSlot,
  OfficeLunchPlan,
  RemainingNutritionBudget,
  ScheduleSlot,
  WeeklyMealPrepResult,
} from "@/lib/planner";
import type {
  DataSourceAvailability,
  DataSourceStatus,
} from "./availability";

export type CoachPlanAvailabilityStatus =
  | "available"
  | "unavailable"
  | "not-applicable"
  | "invalid-input";

export interface TraceableValue<T> {
  value: T;
  sourceIds: string[];
}

export interface TodayCoachTimelineItem extends ScheduleSlot {
  id: string;
  date: string;
  kind:
    | "breakfast"
    | "lunch"
    | "snack"
    | "dinner"
    | "workout"
    | "waterReminder"
    | "sleepPreparation";
  action: string;
  reason: string;
  alternative: string | null;
  impact: TodayCoachTimelineImpact[];
  status: TodayCoachTimelineStatus;
  statusMessage: string;
  completionSource: TodayCoachTimelineCompletionSource;
  manualCompletionAllowed: boolean;
  sourceIds: string[];
}

export type TodayCoachTimelineStatus =
  | "pending"
  | "completed"
  | "missed"
  | "adjusted";

export type TodayCoachTimelineCompletionSource =
  | "meal-log"
  | "water-log"
  | "workout-log"
  | "manual";

export interface TodayCoachTimelineImpact {
  metric: "calories" | "proteinG" | "waterMl" | "workoutMin";
  plannedValue: number | null;
  dailyTarget: number;
  unit: "kcal" | "g" | "ml" | "min";
  sourceIds: string[];
}

export interface TodayCoachTimelineDataAvailability {
  mealLogs: DataSourceStatus;
  waterLogs: DataSourceStatus;
  workoutLogs: DataSourceStatus;
  manualCompletions: DataSourceStatus;
}

export interface TodayCoachMealGuidance extends MealRecommendation {
  sourceIds: string[];
}

export interface TodayCoachMeals {
  breakfast: TodayCoachMealGuidance;
  lunch: TodayCoachMealGuidance;
  snack: TodayCoachMealGuidance;
  dinner: TodayCoachMealGuidance;
}

export interface TodayCoachBriefing {
  retainedInsights: CoachDecision["insights"];
  encouragement: TraceableValue<string> | null;
  sourceIds: string[];
}

export interface TodayCoachDataAvailability {
  decision: "available";
  dailyPlan: "available";
  mealPlan: "available";
  officeLunch: CoachPlanAvailabilityStatus;
  emergencyAdjustment: CoachPlanAvailabilityStatus;
  adaptiveAdjustments: CoachPlanAvailabilityStatus;
  weeklyContext: CoachPlanAvailabilityStatus;
  timelineStatus: TodayCoachTimelineDataAvailability;
  sources: {
    profile: DataSourceAvailability;
    settings: DataSourceAvailability;
    currentDateTime: DataSourceAvailability;
    weights: DataSourceAvailability;
    meals: DataSourceAvailability;
    water: DataSourceAvailability;
    workouts: DataSourceAvailability;
    sleep: DataSourceAvailability;
    cycles: DataSourceAvailability;
    motivations: DataSourceAvailability;
    timelineCompletions: DataSourceAvailability;
  };
  cache: DataSourceAvailability;
}

export type TodayCoachPlanWarningCode =
  | "office-lunch-budget-unavailable"
  | "weekly-planning-input-unavailable"
  | "emergency-disruption-unavailable"
  | "office-lunch-invalid-input"
  | "weekly-planning-invalid-input"
  | "emergency-adjustment-invalid-input"
  | "adaptive-adjustment-invalid-input"
  | "timeline-meal-logs-unavailable"
  | "timeline-water-logs-unavailable"
  | "timeline-workout-logs-unavailable"
  | "timeline-manual-completions-unavailable"
  | "optional-source-unavailable"
  | "cached-plan-stale";

export interface TodayCoachPlanWarning {
  code: TodayCoachPlanWarningCode;
  message: string;
  sourceIds: string[];
}

export interface TodayCoachPlan {
  generatedAt: string;
  date: string;
  status: "ready" | "partial";
  greeting: TraceableValue<string>;
  briefing: TodayCoachBriefing;
  focus: TraceableValue<InsightSummary> | null;
  biggestRisk: TraceableValue<InsightSummary> | null;
  todaysWin: TraceableValue<InsightSummary> | null;
  timeline: TodayCoachTimelineItem[];
  meals: TodayCoachMeals;
  metrics: TraceableValue<DailyTargets>;
  officeLunch: TraceableValue<OfficeLunchPlan> | null;
  emergencyAdjustment: TraceableValue<EmergencyPlanResult> | null;
  adaptiveAdjustments: TraceableValue<AdaptiveAdjustmentResult>;
  weeklyContext: TraceableValue<WeeklyMealPrepResult> | null;
  dataAvailability: TodayCoachDataAvailability;
  warnings: TodayCoachPlanWarning[];
}

export interface TodayCoachPlanOptions {
  remainingNutritionBudget?: RemainingNutritionBudget;
  officeLunchByDate?: Readonly<Record<string, boolean>>;
  ingredientCatalogue?: ApprovedIngredientCatalogue;
  emergencyDisruption?: EmergencyDisruption;
}

export const TODAY_COACH_MEAL_SLOTS: readonly MealSlot[] = [
  "breakfast",
  "lunch",
  "snack",
  "dinner",
];
