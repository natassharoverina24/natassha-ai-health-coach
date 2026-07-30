import { NextResponse } from "next/server";

import type {
  ManualNutritionEstimate,
  NutritionEstimateConfidence,
} from "@/lib/ai/manualNutritionEstimate";
import { authenticateFirebaseRequest } from "@/lib/firebase/serverAuth";

const GEMINI_API_ROOT =
  "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_GEMINI_MEAL_NUTRITION_MODEL =
  "gemini-3.5-flash-lite";
const MAX_REQUEST_TEXT = 240;
const MAX_ASSUMPTIONS = 10;
const PROHIBITED_GUIDANCE =
  /\b(thyroid|diagnos(?:e|is)|treat(?:ment)?|cure|medication|supplement|prescri(?:be|ption)|medical advice|you should|recommend(?:ation)?|avoid eating|diet plan)\b/i;

const SYSTEM_PROMPT = `Estimate nutrition only for the food name and serving supplied by the user.
Return JSON only with this exact shape:
{"servingGrams":1,"calories":1,"proteinG":0,"carbsG":0,"fatG":0,"confidence":"low","assumptions":[]}
Treat every value as an uncertain estimate. Calories must be greater than zero.
Do not provide recommendations, coaching decisions, diagnoses, medical claims, diets, restrictions, supplements, or medication guidance.`;

interface GeminiPart {
  text?: unknown;
}

function safeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length > 0 && result.length <= MAX_REQUEST_TEXT
    ? result
    : null;
}

function safeNumber(
  value: unknown,
  minimum: number,
  maximum = 10_000,
): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : null;
}

function safeAssumption(value: unknown): string | null {
  const result = safeText(value);
  return result && !PROHIBITED_GUIDANCE.test(result) ? result : null;
}

export function sanitizeManualNutritionProviderOutput(
  value: unknown,
  estimatedAt: string,
): ManualNutritionEstimate | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const servingGrams = safeNumber(candidate.servingGrams, 0.1);
  const calories = safeNumber(candidate.calories, 0.1);
  const proteinG = safeNumber(candidate.proteinG, 0);
  const carbsG = safeNumber(candidate.carbsG, 0);
  const fatG = safeNumber(candidate.fatG, 0);
  const confidence = candidate.confidence;
  if (
    servingGrams === null ||
    calories === null ||
    proteinG === null ||
    carbsG === null ||
    fatG === null ||
    !["low", "medium", "high"].includes(String(confidence)) ||
    !Array.isArray(candidate.assumptions) ||
    candidate.assumptions.length > MAX_ASSUMPTIONS
  ) {
    return null;
  }
  const assumptions = candidate.assumptions.map(safeAssumption);
  if (assumptions.some((item) => item === null)) return null;
  return {
    source: "gemini-estimate",
    servingGrams,
    macros: { calories, proteinG, carbsG, fatG },
    confidence: confidence as NutritionEstimateConfidence,
    assumptions: assumptions as string[],
    uncertain: true,
    estimatedAt,
  };
}

function extractProviderJson(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  const candidates = (value as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const content = (candidates[0] as { content?: unknown })?.content;
  if (!content || typeof content !== "object") return null;
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return null;
  const text = (parts as GeminiPart[])
    .filter((part) => typeof part.text === "string")
    .map((part) => part.text)
    .join("");
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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
  const name = safeText((body as Record<string, unknown>).name);
  const quantityValue = (body as Record<string, unknown>).quantity;
  const quantity =
    quantityValue === null || quantityValue === undefined
      ? null
      : safeText(quantityValue);
  if (!name || (quantityValue != null && !quantity)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Nutrition estimate unavailable" },
      { status: 503 },
    );
  }
  const model =
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MEAL_NUTRITION_MODEL;
  try {
    const providerResponse = await fetch(
      `${GEMINI_API_ROOT}/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: JSON.stringify({
                  foodName: name,
                  serving: quantity ?? "not supplied",
                }),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 500,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              servingGrams: { type: "number" },
              calories: { type: "number" },
              proteinG: { type: "number" },
              carbsG: { type: "number" },
              fatG: { type: "number" },
              confidence: {
                type: "string",
                enum: ["low", "medium", "high"],
              },
              assumptions: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: [
              "servingGrams",
              "calories",
              "proteinG",
              "carbsG",
              "fatG",
              "confidence",
              "assumptions",
            ],
          },
        },
        }),
        cache: "no-store",
      },
    );
    if (providerResponse.status === 429) {
      return NextResponse.json(
        { error: "Nutrition estimate unavailable" },
        { status: 429 },
      );
    }
    if (!providerResponse.ok) {
      return NextResponse.json(
        { error: "Nutrition estimate unavailable" },
        { status: 502 },
      );
    }
    const estimate = sanitizeManualNutritionProviderOutput(
      extractProviderJson(await providerResponse.json()),
      new Date().toISOString(),
    );
    if (!estimate) {
      return NextResponse.json(
        { error: "Nutrition estimate unavailable" },
        { status: 502 },
      );
    }
    return NextResponse.json({ estimate });
  } catch {
    return NextResponse.json(
      { error: "Nutrition estimate unavailable" },
      { status: 502 },
    );
  }
}
