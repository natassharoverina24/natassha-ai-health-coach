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
  kind:
    | "breakfast"
    | "lunch"
    | "snack"
    | "dinner"
    | "workout"
    | "waterReminder";
  sourceIds: string[];
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
}

export type TodayCoachPlanWarningCode =
  | "office-lunch-budget-unavailable"
  | "weekly-planning-input-unavailable"
  | "emergency-disruption-unavailable"
  | "office-lunch-invalid-input"
  | "weekly-planning-invalid-input"
  | "emergency-adjustment-invalid-input"
  | "adaptive-adjustment-invalid-input";

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
