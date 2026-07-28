export const SUPPORTED_MEAL_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_MEAL_IMAGE_BYTES = 4 * 1024 * 1024;

export type MealImageMimeType =
  (typeof SUPPORTED_MEAL_IMAGE_TYPES)[number];
export type MealPhotoConfidence = "low" | "medium" | "high";

export interface MealPhotoEstimateItem {
  name: string;
  estimatedPortion: string;
}

export interface MealPhotoAnalysis {
  items: MealPhotoEstimateItem[];
  estimatedCalories: number;
  estimatedProteinG: number;
  confidence: MealPhotoConfidence;
  uncertain: true;
  assumptions: string[];
  estimatedAt: string;
}

export interface ConfirmedMealPhotoEstimate {
  foodName: string;
  portion: string;
  calories: number;
  proteinG: number;
  source: "photo-estimate";
  userConfirmed: true;
  estimatedAt: string;
}

export interface ConfirmedMealUpdate {
  name: string;
  quantity: string;
  macros: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number | null;
  };
  photoEstimate: {
    source: "photo-estimate";
    userConfirmed: true;
    estimatedAt: string;
  };
}

export function buildConfirmedMealUpdate(
  currentMacros: ConfirmedMealUpdate["macros"],
  estimate: ConfirmedMealPhotoEstimate,
): ConfirmedMealUpdate {
  return {
    name: estimate.foodName,
    quantity: estimate.portion,
    macros: {
      ...currentMacros,
      calories: estimate.calories,
      proteinG: estimate.proteinG,
    },
    photoEstimate: {
      source: "photo-estimate",
      userConfirmed: true,
      estimatedAt: estimate.estimatedAt,
    },
  };
}

export function isSupportedMealImageType(
  type: string,
): type is MealImageMimeType {
  return SUPPORTED_MEAL_IMAGE_TYPES.includes(type as MealImageMimeType);
}
