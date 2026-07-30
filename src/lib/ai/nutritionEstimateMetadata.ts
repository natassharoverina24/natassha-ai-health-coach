import type {
  MealNutritionAuditSource,
  MealNutritionEstimateMetadata,
  MealNutritionEstimateSource,
} from "@/types/firestore";

const SOURCE_BY_ESTIMATE: Record<
  MealNutritionEstimateSource,
  MealNutritionAuditSource
> = {
  "local-approved": "local",
  "user-confirmed-cache": "cache",
  "gemini-estimate": "gemini",
  "groq-estimate": "groq",
  "openrouter-estimate": "openrouter",
  "manual-entry": "manual",
};

const LABEL_BY_SOURCE: Record<MealNutritionAuditSource, string> = {
  local: "From local food database",
  cache: "From your saved food cache",
  gemini: "Estimated with Gemini",
  groq: "Estimated with Groq",
  openrouter: "Estimated with OpenRouter Free",
  manual: "Entered manually",
};

export function buildNutritionEstimateMetadata({
  source,
  model = null,
  estimatedAt = null,
  confidence = null,
}: {
  source: MealNutritionEstimateSource;
  model?: string | null;
  estimatedAt?: string | null;
  confidence?: "low" | "medium" | "high" | null;
}): MealNutritionEstimateMetadata {
  const auditSource = SOURCE_BY_ESTIMATE[source];
  return {
    source: auditSource,
    providerLabel: LABEL_BY_SOURCE[auditSource],
    model,
    estimatedAt,
    confidence,
  };
}
