import type { CoachDecision } from "@/lib/engines/decisionEngine";
import {
  rankMealCandidates,
  type DailyPlan,
  type MealPlan,
  type MealSlot,
  type OfficeLunchPlan,
  type PlannerUserContext,
} from "@/lib/planner";
import type { MealEntry, MealMacro } from "@/types/firestore";
import { hasConfirmedMealNutrition } from "@/lib/utils/nutritionEstimates";
import {
  buildSubstitutionOptions,
  getTemplatePracticalAvailability,
} from "@/lib/meal-substitutions";
import {
  TODAY_COACH_MEAL_SLOTS,
  type ConfirmedMealConsumption,
  type MealAlternative,
  type MealGuidanceNutrition,
  type TodayCoachMealGuidance,
  type TodayCoachMeals,
} from "./types";

const MEAL_RELEVANT_INSIGHT_IDS = new Set([
  "migraine.active_symptom_care",
  "menstrual.pms_hunger_support",
  "nutrition.protein_first",
]);

function nutritionFromTemplate(
  template: MealPlan[MealSlot]["template"],
): MealGuidanceNutrition {
  return {
    caloriesKcal: template.calories,
    proteinG: template.proteinG,
    carbohydrateG: template.carbsG,
    fatG: template.fatG,
  };
}

function sumLoggedNutrition(entries: readonly MealEntry[]): MealMacro {
  return entries.reduce<MealMacro>(
    (total, entry) => ({
      calories: total.calories + entry.macros.calories,
      proteinG: total.proteinG + entry.macros.proteinG,
      carbsG: total.carbsG + entry.macros.carbsG,
      fatG: total.fatG + entry.macros.fatG,
      fiberG: (total.fiberG ?? 0) + (entry.macros.fiberG ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  );
}

function confirmedConsumption(
  entries: readonly MealEntry[],
): ConfirmedMealConsumption | null {
  const confirmedEntries = entries.filter(hasConfirmedMealNutrition);
  if (confirmedEntries.length === 0) return null;
  const macros = sumLoggedNutrition(confirmedEntries);
  return {
    entryCount: confirmedEntries.length,
    nutrition: {
      caloriesKcal: macros.calories,
      proteinG: macros.proteinG,
      carbohydrateG: macros.carbsG,
      fatG: macros.fatG,
    },
    sourceIds: confirmedEntries.map((entry) => `meal-log:${entry.id}`),
  };
}

function alternativesFor(
  decision: CoachDecision,
  context: PlannerUserContext,
  slot: MealSlot,
  selectedTemplateId: string,
): MealAlternative[] {
  const ranked = rankMealCandidates(
    decision,
    context,
    slot,
    new Set([selectedTemplateId]),
  );
  const common = ranked.filter(
    ({ template }) => getTemplatePracticalAvailability(template.id) === "common",
  );
  const optional = ranked.filter(
    ({ template }) => getTemplatePracticalAvailability(template.id) === "optional",
  );

  return [...common, ...optional]
    .slice(0, 2)
    .map(({ template }) => ({
      templateId: template.id,
      name: template.name,
      servingText: template.serving,
      nutrition: nutritionFromTemplate(template),
      availability: getTemplatePracticalAvailability(template.id),
      provenance: "local-catalog",
      practicalSubstitutions: buildSubstitutionOptions(template.id),
      sourceIds: [
        `planner.meal.alternative.${slot}`,
        `meal-template:${template.id}`,
      ],
    }));
}

function retainedMealSourceIds(
  decision: CoachDecision,
  slot: MealSlot,
  templateId: string,
): string[] {
  return [
    `planner.meal.${slot}`,
    `meal-template:${templateId}`,
    ...decision.insights
      .map((insight) => insight.id)
      .filter((id) => MEAL_RELEVANT_INSIGHT_IDS.has(id)),
  ];
}

export interface BuildMealGuidanceInput {
  decision: CoachDecision;
  context: PlannerUserContext;
  dailyPlan: DailyPlan;
  mealPlan: MealPlan;
  mealLogs: readonly MealEntry[] | null;
  officeLunchPlan: OfficeLunchPlan | null;
}

export function buildMealGuidance({
  decision,
  context,
  dailyPlan,
  mealPlan,
  mealLogs,
  officeLunchPlan,
}: BuildMealGuidanceInput): TodayCoachMeals {
  let remainingCalories = dailyPlan.targets.calories;
  let remainingProtein = dailyPlan.targets.proteinG;

  const guidance = Object.fromEntries(
    TODAY_COACH_MEAL_SLOTS.map((slot, index) => {
      const selected = mealPlan[slot];
      const loggedForSlot = (mealLogs ?? []).filter(
        (entry) => entry.type === slot,
      );
      const confirmed = confirmedConsumption(loggedForSlot);
      const plannedNutrition = nutritionFromTemplate(selected.template);
      const countedNutrition = confirmed?.nutrition ?? plannedNutrition;
      remainingCalories = Math.max(
        0,
        remainingCalories - countedNutrition.caloriesKcal,
      );
      remainingProtein = Math.max(
        0,
        remainingProtein - countedNutrition.proteinG,
      );
      const nextSlot = TODAY_COACH_MEAL_SLOTS[index + 1] ?? null;
      const sourceIds = [
        ...retainedMealSourceIds(decision, slot, selected.template.id),
        ...(confirmed?.sourceIds ?? []),
        "planner.daily.targets",
      ];

      return [
        slot,
        {
          slot,
          scheduledTime: dailyPlan.schedule[slot].time,
          recommendation: {
            templateId: selected.template.id,
            name: selected.template.name,
            servingText: selected.template.serving,
          },
          nutrition: plannedNutrition,
          why: [
            selected.reason,
            ...(confirmed
              ? [
                  `Confirmed ${slot} logs are used for today's remaining calorie and protein targets.`,
                ]
              : []),
          ],
          alternatives: alternativesFor(
            decision,
            context,
            slot,
            selected.template.id,
          ),
          practicalSubstitutions: buildSubstitutionOptions(
            selected.template.id,
          ),
          confirmedConsumption: confirmed,
          remainingAfterMeal: {
            caloriesKcal: remainingCalories,
            proteinG: remainingProtein,
          },
          nextMealImpact: nextSlot
            ? `${remainingCalories} kcal and ${remainingProtein} g protein remain for the rest of today before the planned ${nextSlot}.`
            : null,
          officeLunchAdjustment:
            slot === "lunch" && officeLunchPlan
              ? {
                  plan: officeLunchPlan,
                  sourceIds: [
                    "planner.office-lunch",
                    ...decision.insights.map((insight) => insight.id),
                  ],
                }
              : null,
          sourceIds,
        } satisfies TodayCoachMealGuidance,
      ];
    }),
  );

  return guidance as unknown as TodayCoachMeals;
}
