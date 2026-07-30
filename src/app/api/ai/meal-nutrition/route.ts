import { NextResponse } from "next/server";

import type { ManualNutritionEstimate } from "@/lib/ai/manualNutritionEstimate";
import {
  DEFAULT_GEMINI_NUTRITION_MODEL,
  DEFAULT_GROQ_NUTRITION_MODEL,
  GeminiNutritionProvider,
  GroqNutritionProvider,
  OPENROUTER_FREE_NUTRITION_MODEL,
  OpenRouterNutritionProvider,
  estimateNutritionWithFallback,
} from "@/lib/ai/server/nutritionEstimation";
import { authenticateFirebaseRequest } from "@/lib/firebase/serverAuth";

export const DEFAULT_GEMINI_MEAL_NUTRITION_MODEL =
  DEFAULT_GEMINI_NUTRITION_MODEL;
export const DEFAULT_GROQ_MEAL_NUTRITION_MODEL =
  DEFAULT_GROQ_NUTRITION_MODEL;
export const DEFAULT_OPENROUTER_MEAL_NUTRITION_MODEL =
  OPENROUTER_FREE_NUTRITION_MODEL;

const MAX_REQUEST_TEXT = 240;
const PROVIDER_REQUESTS_PER_HOUR = 10;
const PROVIDER_WINDOW_MS = 60 * 60 * 1_000;

interface ProviderRateWindow {
  startedAt: number;
  count: number;
}

const providerRateWindows = new Map<string, ProviderRateWindow>();

function safeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length > 0 && result.length <= MAX_REQUEST_TEXT
    ? result
    : null;
}

export function resetNutritionProviderRateLimitsForTests() {
  providerRateWindows.clear();
}

function allowProviderRequest(
  userId: string,
  provider: "gemini" | "groq" | "openrouter",
  now = Date.now(),
): boolean {
  const key = `${userId}:${provider}`;
  const current = providerRateWindows.get(key);
  if (!current || now - current.startedAt >= PROVIDER_WINDOW_MS) {
    providerRateWindows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= PROVIDER_REQUESTS_PER_HOUR) return false;
  current.count += 1;
  return true;
}

export async function POST(request: Request) {
  const authentication = await authenticateFirebaseRequest(request);
  if (authentication.status === "unauthenticated") {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }
  if (authentication.status !== "authenticated") {
    return NextResponse.json(
      { error: "Nutrition estimate unavailable" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const candidate = body as Record<string, unknown>;
  const name = safeText(candidate.name);
  const quantity =
    candidate.quantity === null || candidate.quantity === undefined
      ? null
      : safeText(candidate.quantity);
  const portion =
    candidate.portion === null || candidate.portion === undefined
      ? null
      : safeText(candidate.portion);
  if (
    !name ||
    (candidate.quantity != null && !quantity) ||
    (candidate.portion != null && !portion)
  ) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = await estimateNutritionWithFallback(
    { foodName: name, quantity, portion },
    {
      userId: authentication.uid,
      providers: [
        new GeminiNutritionProvider({
          apiKey: process.env.GEMINI_API_KEY?.trim() ?? "",
          model: DEFAULT_GEMINI_MEAL_NUTRITION_MODEL,
        }),
        new GroqNutritionProvider({
          apiKey: process.env.GROQ_API_KEY?.trim() ?? "",
          model: DEFAULT_GROQ_MEAL_NUTRITION_MODEL,
        }),
        new OpenRouterNutritionProvider({
          apiKey: process.env.OPENROUTER_API_KEY?.trim() ?? "",
          model: DEFAULT_OPENROUTER_MEAL_NUTRITION_MODEL,
        }),
      ],
      allowProviderRequest,
    },
  );

  if (result.status === "invalid-input") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (result.status !== "success") {
    return NextResponse.json(
      { error: "Nutrition estimate unavailable" },
      { status: 503 },
    );
  }

  const estimate: ManualNutritionEstimate = {
    source: `${result.provider}-estimate`,
    provider: result.provider,
    model: result.model,
    servingGrams: result.estimate.grams,
    macros: {
      calories: result.estimate.calories,
      proteinG: result.estimate.proteinG,
      carbsG: result.estimate.carbsG,
      fatG: result.estimate.fatG,
      fiberG: result.estimate.fiberG,
    },
    confidence: result.estimate.confidence,
    assumptions: [...result.estimate.assumptions],
    uncertain: true,
    estimatedAt: new Date().toISOString(),
  };
  return NextResponse.json({ estimate });
}
