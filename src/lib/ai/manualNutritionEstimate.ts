"use client";

import {
  hasConfirmedMealNutrition,
  OFFICE_LUNCH_ITEMS,
  QUICK_LOG_FOODS,
} from "@/lib/utils/nutritionEstimates";
import type {
  MealEntry,
  MealNutritionEstimateSource,
  MealNutritionMacro,
  MealNutritionProvider,
} from "@/types/firestore";

export type NutritionEstimateConfidence = "low" | "medium" | "high";

export interface ManualNutritionEstimate {
  source: Exclude<MealNutritionEstimateSource, "manual-entry">;
  provider: MealNutritionProvider | null;
  model: string | null;
  servingGrams: number | null;
  macros: MealNutritionMacro;
  assumptions: string[];
  confidence: NutritionEstimateConfidence;
  uncertain: boolean;
  estimatedAt: string;
}

export type ManualNutritionEstimateResult =
  | { status: "ready"; estimate: ManualNutritionEstimate }
  | {
      status: "unavailable";
      message: "Nutrition estimate unavailable";
    };

export interface ManualNutritionEstimateRequest {
  name: string;
  quantity: string | null;
}

const LOCAL_ESTIMATES = Array.from(
  new Map(
    [...OFFICE_LUNCH_ITEMS, ...QUICK_LOG_FOODS].map((entry) => [
      entry.key,
      entry,
    ]),
  ).values(),
);

function normalizeFoodName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function findApprovedNutritionEstimate(
  request: ManualNutritionEstimateRequest,
  estimatedAt = new Date().toISOString(),
): ManualNutritionEstimate | null {
  const normalized = normalizeFoodName(request.name);
  const match = LOCAL_ESTIMATES.find(
    (entry) =>
      normalizeFoodName(entry.label) === normalized ||
      normalizeFoodName(entry.key) === normalized,
  );
  if (!match) return null;
  return {
    source: "local-approved",
    provider: null,
    model: null,
    servingGrams: null,
    macros: {
      calories: match.macros.calories,
      proteinG: match.macros.proteinG,
      carbsG: match.macros.carbsG,
      fatG: match.macros.fatG,
    },
    assumptions: [
      `Approved local serving used: ${match.serving}.`,
    ],
    confidence: "high",
    uncertain: false,
    estimatedAt,
  };
}

export function findUserConfirmedNutritionEstimate(
  request: ManualNutritionEstimateRequest,
  meals: readonly MealEntry[],
): ManualNutritionEstimate | null {
  const normalizedName = normalizeFoodName(request.name);
  const normalizedQuantity = normalizeFoodName(request.quantity ?? "");
  const match = [...meals]
    .filter(
      (meal) =>
        hasConfirmedMealNutrition(meal) &&
        meal.nutritionConfirmation?.status === "confirmed" &&
        meal.nutritionConfirmation.userConfirmed === true &&
        normalizeFoodName(meal.name) === normalizedName &&
        normalizeFoodName(meal.quantity ?? "") === normalizedQuantity,
    )
    .sort((left, right) => {
      const leftDate =
        left.nutritionConfirmation?.confirmedAt ?? left.updatedAt;
      const rightDate =
        right.nutritionConfirmation?.confirmedAt ?? right.updatedAt;
      return rightDate.localeCompare(leftDate) || left.id.localeCompare(right.id);
    })[0];
  if (!match) return null;
  return {
    source: "user-confirmed-cache",
    provider: match.nutritionConfirmation?.provider ?? null,
    model: match.nutritionConfirmation?.model ?? null,
    servingGrams:
      match.nutritionConfirmation?.servingGrams ?? null,
    macros: {
      calories: match.macros.calories,
      proteinG: match.macros.proteinG,
      carbsG: match.macros.carbsG,
      fatG: match.macros.fatG,
      fiberG: match.macros.fiberG,
    },
    assumptions: [
      "Previously confirmed by you for the same food and quantity.",
    ],
    confidence: "high",
    uncertain: false,
    estimatedAt:
      match.nutritionConfirmation?.estimatedAt ??
      match.nutritionConfirmation?.confirmedAt ??
      match.updatedAt,
  };
}

function isFiniteRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

export function parseManualNutritionEstimate(
  value: unknown,
): ManualNutritionEstimate | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const sourceToProvider = {
    "gemini-estimate": "gemini",
    "groq-estimate": "groq",
    "openrouter-estimate": "openrouter",
  } as const;
  if (
    typeof candidate.source !== "string" ||
    !(candidate.source in sourceToProvider) ||
    candidate.provider !==
      sourceToProvider[
        candidate.source as keyof typeof sourceToProvider
      ] ||
    typeof candidate.model !== "string" ||
    candidate.model.trim().length === 0 ||
    candidate.model.length > 160 ||
    !isFiniteRange(candidate.servingGrams, 0.1, 10_000) ||
    !candidate.macros ||
    typeof candidate.macros !== "object"
  ) {
    return null;
  }
  const macros = candidate.macros as Record<string, unknown>;
  if (
    !isFiniteRange(macros.calories, 0.1, 10_000) ||
    !isFiniteRange(macros.proteinG, 0, 10_000) ||
    !isFiniteRange(macros.carbsG, 0, 10_000) ||
    !isFiniteRange(macros.fatG, 0, 10_000) ||
    (macros.fiberG !== null &&
      macros.fiberG !== undefined &&
      !isFiniteRange(macros.fiberG, 0, 10_000))
  ) {
    return null;
  }
  if (
    !Array.isArray(candidate.assumptions) ||
    candidate.assumptions.length > 10 ||
    candidate.assumptions.some(
      (item) =>
        typeof item !== "string" ||
        item.trim().length === 0 ||
        item.length > 200,
    )
  ) {
    return null;
  }
  if (!["low", "medium", "high"].includes(String(candidate.confidence))) {
    return null;
  }
  if (
    candidate.uncertain !== true ||
    typeof candidate.estimatedAt !== "string" ||
    Number.isNaN(new Date(candidate.estimatedAt).getTime())
  ) {
    return null;
  }
  return {
    source: candidate.source as
      | "gemini-estimate"
      | "groq-estimate"
      | "openrouter-estimate",
    provider: candidate.provider as MealNutritionProvider,
    model: candidate.model.trim(),
    servingGrams: candidate.servingGrams,
    macros: {
      calories: macros.calories,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
      fiberG:
        macros.fiberG === null || macros.fiberG === undefined
          ? null
          : isFiniteRange(macros.fiberG, 0, 10_000)
            ? macros.fiberG
            : null,
    },
    assumptions: candidate.assumptions.map((item) => String(item).trim()),
    confidence: candidate.confidence as NutritionEstimateConfidence,
    uncertain: true,
    estimatedAt: candidate.estimatedAt,
  };
}

export async function requestManualNutritionEstimate(
  request: ManualNutritionEstimateRequest,
  options: {
    getIdToken?: () => Promise<string | null>;
    getConfirmedMeals?: () => Promise<readonly MealEntry[]>;
    fetcher?: typeof fetch;
    now?: () => string;
  } = {},
): Promise<ManualNutritionEstimateResult> {
  const local = findApprovedNutritionEstimate(
    request,
    options.now?.() ?? new Date().toISOString(),
  );
  if (local) return { status: "ready", estimate: local };

  try {
    if (options.getConfirmedMeals) {
      try {
        const cached = findUserConfirmedNutritionEstimate(
          request,
          await options.getConfirmedMeals(),
        );
        if (cached) return { status: "ready", estimate: cached };
      } catch {
        // An optional cache failure must not block server-side estimation.
      }
    }
    const getIdToken =
      options.getIdToken ??
      (async () => {
        const { getCurrentUserIdToken } = await import("@/lib/firebase/auth");
        return getCurrentUserIdToken();
      });
    const token = await getIdToken();
    if (!token) {
      return {
        status: "unavailable",
        message: "Nutrition estimate unavailable",
      };
    }
    const response = await (options.fetcher ?? fetch)(
      "/api/ai/meal-nutrition",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        cache: "no-store",
      },
    );
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || typeof body !== "object") {
      return {
        status: "unavailable",
        message: "Nutrition estimate unavailable",
      };
    }
    const estimate = parseManualNutritionEstimate(
      (body as { estimate?: unknown }).estimate,
    );
    return estimate
      ? { status: "ready", estimate }
      : {
          status: "unavailable",
          message: "Nutrition estimate unavailable",
        };
  } catch {
    return {
      status: "unavailable",
      message: "Nutrition estimate unavailable",
    };
  }
}
