import { OFFICE_LUNCH_ITEMS } from "@/lib/utils/nutritionEstimates";

export type PracticalFoodRole =
  | "protein"
  | "carb"
  | "vegetable-fiber"
  | "fruit-snack"
  | "drink";

export type PracticalSubstituteProvenance =
  | "local-catalog"
  | "user-confirmed"
  | "ai-assisted"
  | "needs-confirmation";

export type PracticalFoodAvailability = "common" | "optional";

export interface PracticalSubstituteNutrition {
  caloriesKcal: number;
  proteinG: number;
  carbohydrateG: number;
  fatG: number;
}

export interface PracticalMealSubstitute {
  id: string;
  label: string;
  role: PracticalFoodRole;
  availability: PracticalFoodAvailability;
  provenance: PracticalSubstituteProvenance;
  nutritionStatus: "approved" | "needs-confirmation";
  nutrition: PracticalSubstituteNutrition | null;
  sourceIds: string[];
}

export interface PracticalSubstitutionGroup {
  role: PracticalFoodRole;
  options: PracticalMealSubstitute[];
}

interface CatalogueSeed {
  id: string;
  label: string;
  role: PracticalFoodRole;
  availability?: PracticalFoodAvailability;
  approvedOfficeLunchKey?: string;
}

const CATALOGUE_SEEDS: readonly CatalogueSeed[] = [
  { id: "chicken", label: "Ayam", role: "protein", approvedOfficeLunchKey: "chicken" },
  { id: "egg", label: "Telur", role: "protein", approvedOfficeLunchKey: "egg" },
  { id: "tempe", label: "Tempe", role: "protein", approvedOfficeLunchKey: "tempe" },
  { id: "tofu", label: "Tahu", role: "protein", approvedOfficeLunchKey: "tofu" },
  { id: "fish", label: "Ikan", role: "protein", approvedOfficeLunchKey: "fish" },
  { id: "tuna", label: "Tuna", role: "protein" },
  { id: "plain-yogurt", label: "Plain yogurt", role: "protein", availability: "optional" },
  { id: "edamame", label: "Edamame", role: "protein", availability: "optional" },

  { id: "white-rice", label: "Nasi putih", role: "carb", approvedOfficeLunchKey: "rice" },
  { id: "brown-rice", label: "Nasi merah", role: "carb" },
  { id: "potato", label: "Kentang", role: "carb" },
  { id: "sweet-potato", label: "Ubi", role: "carb" },
  { id: "whole-wheat-bread", label: "Roti gandum", role: "carb" },
  { id: "oatmeal", label: "Oatmeal", role: "carb" },

  { id: "mixed-vegetables", label: "Sayur", role: "vegetable-fiber", approvedOfficeLunchKey: "vegetables" },
  { id: "spinach", label: "Bayam", role: "vegetable-fiber" },
  { id: "water-spinach", label: "Kangkung", role: "vegetable-fiber" },
  { id: "broccoli", label: "Brokoli", role: "vegetable-fiber", availability: "optional" },
  { id: "capcay", label: "Capcay", role: "vegetable-fiber" },
  { id: "lalapan", label: "Lalapan", role: "vegetable-fiber" },
  { id: "beans-carrot", label: "Buncis dan wortel", role: "vegetable-fiber" },

  { id: "fruit", label: "Buah", role: "fruit-snack", approvedOfficeLunchKey: "fruit" },
  { id: "banana", label: "Pisang", role: "fruit-snack" },
  { id: "apple", label: "Apel", role: "fruit-snack" },
  { id: "papaya", label: "Pepaya", role: "fruit-snack" },
  { id: "cut-fruit", label: "Buah potong", role: "fruit-snack" },
  { id: "peanuts", label: "Kacang", role: "fruit-snack" },

  { id: "water", label: "Air putih", role: "drink" },
  { id: "unsweetened-tea", label: "Teh tawar", role: "drink" },
  { id: "coffee-no-sugar", label: "Kopi tanpa gula", role: "drink" },
] as const;

function approvedNutrition(key: string | undefined): PracticalSubstituteNutrition | null {
  if (!key) return null;
  const item = OFFICE_LUNCH_ITEMS.find((candidate) => candidate.key === key);
  if (!item) return null;
  return {
    caloriesKcal: item.macros.calories,
    proteinG: item.macros.proteinG,
    carbohydrateG: item.macros.carbsG,
    fatG: item.macros.fatG,
  };
}

export const PRACTICAL_FOOD_CATALOGUE: readonly PracticalMealSubstitute[] =
  CATALOGUE_SEEDS.map((seed) => {
    const nutrition = approvedNutrition(seed.approvedOfficeLunchKey);
    return {
      id: seed.id,
      label: seed.label,
      role: seed.role,
      availability: seed.availability ?? "common",
      provenance: "local-catalog",
      nutritionStatus: nutrition ? "approved" : "needs-confirmation",
      nutrition,
      sourceIds: nutrition
        ? ["meal-substitution.local-catalog", `office-lunch-item:${seed.approvedOfficeLunchKey}`]
        : ["meal-substitution.local-catalog", "nutrition.needs-confirmation"],
    };
  });

const TEMPLATE_ROLE_SEEDS: Readonly<Record<string, readonly [PracticalFoodRole, string][]>> = {
  "oatmeal-banana": [["carb", "oatmeal"], ["fruit-snack", "banana"]],
  "eggs-toast": [["protein", "egg"], ["carb", "whole-wheat-bread"]],
  "tempe-rice-breakfast": [["protein", "tempe"], ["carb", "white-rice"]],
  "toast-peanut-butter": [["carb", "whole-wheat-bread"], ["fruit-snack", "peanuts"]],
  "bubur-ayam": [["protein", "chicken"], ["carb", "white-rice"]],
  "chicken-rice-veg": [["protein", "chicken"], ["carb", "white-rice"], ["vegetable-fiber", "mixed-vegetables"]],
  "fish-rice-veg": [["protein", "fish"], ["carb", "white-rice"], ["vegetable-fiber", "mixed-vegetables"]],
  "tofu-tempe-rice": [["protein", "tofu"], ["protein", "tempe"], ["carb", "white-rice"], ["vegetable-fiber", "mixed-vegetables"]],
  "egg-rice-sambal": [["protein", "egg"], ["carb", "white-rice"]],
  "soto-ayam": [["protein", "chicken"], ["carb", "white-rice"], ["vegetable-fiber", "mixed-vegetables"]],
  "nasi-goreng-protein": [["protein", "egg"], ["protein", "chicken"], ["carb", "white-rice"]],
  "gado-gado": [["protein", "tofu"], ["protein", "tempe"], ["vegetable-fiber", "mixed-vegetables"]],
  "chicken-soup-sayur": [["protein", "chicken"], ["vegetable-fiber", "mixed-vegetables"]],
  "boiled-eggs-snack": [["protein", "egg"]],
  "banana-peanuts": [["fruit-snack", "banana"], ["fruit-snack", "peanuts"]],
  "tempe-chips": [["protein", "tempe"]],
  "fruit-yogurt": [["fruit-snack", "fruit"], ["protein", "plain-yogurt"]],
  "edamame-snack": [["protein", "edamame"]],
};

const OPTIONAL_TEMPLATE_IDS = new Set(["fruit-yogurt", "edamame-snack"]);

export function getTemplatePracticalAvailability(templateId: string): PracticalFoodAvailability {
  return OPTIONAL_TEMPLATE_IDS.has(templateId) ? "optional" : "common";
}

export function classifyFoodRole(foodId: string): PracticalFoodRole | null {
  return PRACTICAL_FOOD_CATALOGUE.find((item) => item.id === foodId)?.role ?? null;
}

export function getPracticalMealSubstitutes(
  role: PracticalFoodRole,
  excludedIds: readonly string[] = [],
): PracticalMealSubstitute[] {
  const excluded = new Set(excludedIds);
  return PRACTICAL_FOOD_CATALOGUE.filter(
    (item) => item.role === role && !excluded.has(item.id),
  )
    .sort((left, right) => {
      if (left.availability === right.availability) return 0;
      return left.availability === "common" ? -1 : 1;
    })
    .map((item) => ({
      ...item,
      nutrition: item.nutrition ? { ...item.nutrition } : null,
      sourceIds: [...item.sourceIds],
    }));
}

export function buildSubstitutionOptions(templateId: string): PracticalSubstitutionGroup[] {
  const seeds = TEMPLATE_ROLE_SEEDS[templateId];
  if (!seeds) return [];

  const roles = [...new Set(seeds.map(([role]) => role))];
  return roles.map((role) => ({
    role,
    options: getPracticalMealSubstitutes(
      role,
      seeds.filter(([seedRole]) => seedRole === role).map(([, foodId]) => foodId),
    ),
  }));
}
