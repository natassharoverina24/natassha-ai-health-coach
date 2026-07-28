import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";

import {
  MAX_MEAL_IMAGE_BYTES,
  isSupportedMealImageType,
  type MealPhotoAnalysis,
  type MealPhotoConfidence,
  type MealPhotoEstimateItem,
} from "@/lib/ai/mealPhotoAnalysis";
import { consumeMealPhotoRateLimit } from "@/lib/ai/mealPhotoRateLimit";
import { authenticateFirebaseRequest } from "@/lib/firebase/serverAuth";

const GEMINI_API_ROOT =
  "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_GEMINI_MEAL_PHOTO_MODEL = "gemini-3.5-flash-lite";
const MAX_RESPONSE_TOKENS = 700;
const MAX_ITEMS = 20;
const MAX_ASSUMPTIONS = 10;
const MAX_TEXT_LENGTH = 160;
const PROHIBITED_GUIDANCE =
  /\b(thyroid|diagnos(?:e|is)|treat(?:ment)?|cure|medication|supplement|prescri(?:be|ption)|medical advice|you should|recommend(?:ation)?|avoid eating|diet plan)\b/i;

const ANALYSIS_SYSTEM_PROMPT = `Analyze only food visibly present in the supplied image.
Return JSON only with this exact shape:
{"items":[{"name":"visible food","estimatedPortion":"uncertain portion estimate"}],"estimatedCalories":0,"estimatedProteinG":0,"confidence":"low","assumptions":[]}
Calories, protein, and portions are uncertain estimates, never facts.
Do not provide recommendations, coaching decisions, diagnoses, medical claims, diets, restrictions, supplements, or medication guidance.
Do not infer health conditions or anything not visibly supported by the image.`;

interface GeminiPart {
  type?: unknown;
  text?: unknown;
}

function safeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_TEXT_LENGTH ||
    PROHIBITED_GUIDANCE.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

function safeEstimate(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100_000
    ? value
    : null;
}

function sanitizeProviderOutput(
  value: unknown,
  estimatedAt: string,
): MealPhotoAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.items) || candidate.items.length === 0) {
    return null;
  }
  if (candidate.items.length > MAX_ITEMS) return null;

  const items: MealPhotoEstimateItem[] = [];
  for (const rawItem of candidate.items) {
    if (!rawItem || typeof rawItem !== "object") return null;
    const item = rawItem as Record<string, unknown>;
    const name = safeString(item.name);
    const estimatedPortion = safeString(item.estimatedPortion);
    if (!name || !estimatedPortion) return null;
    items.push({ name, estimatedPortion });
  }

  const estimatedCalories = safeEstimate(candidate.estimatedCalories);
  const estimatedProteinG = safeEstimate(candidate.estimatedProteinG);
  if (estimatedCalories === null || estimatedProteinG === null) return null;

  const confidence = candidate.confidence;
  if (!["low", "medium", "high"].includes(String(confidence))) return null;
  if (
    !Array.isArray(candidate.assumptions) ||
    candidate.assumptions.length > MAX_ASSUMPTIONS
  ) {
    return null;
  }
  const assumptions: string[] = [];
  for (const rawAssumption of candidate.assumptions) {
    const assumption = safeString(rawAssumption);
    if (!assumption) return null;
    assumptions.push(assumption);
  }

  return {
    items,
    estimatedCalories,
    estimatedProteinG,
    confidence: confidence as MealPhotoConfidence,
    uncertain: true,
    assumptions,
    estimatedAt,
  };
}

function extractProviderJson(value: unknown): unknown {
  if (!value || typeof value !== "object" || !("candidates" in value)) {
    return null;
  }
  const candidates = (value as { candidates: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const first = candidates[0];
  if (!first || typeof first !== "object" || !("content" in first)) return null;
  const content = (first as { content: unknown }).content;
  if (!content || typeof content !== "object" || !("parts" in content)) {
    return null;
  }
  const parts = (content as { parts: unknown }).parts;
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
  if (authentication.status === "configuration-error") {
    return NextResponse.json(
      { error: "Firebase authentication is not configured on the server." },
      { status: 503 },
    );
  }
  if (authentication.status === "verification-unavailable") {
    return NextResponse.json(
      { error: "Authentication verification is temporarily unavailable." },
      { status: 503 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return NextResponse.json(
      { error: "A multipart image upload is required." },
      { status: 415 },
    );
  }
  const declaredLengthHeader = request.headers.get("content-length");
  const declaredLength = Number(declaredLengthHeader);
  if (
    !declaredLengthHeader ||
    !Number.isFinite(declaredLength) ||
    declaredLength <= 0 ||
    declaredLength > MAX_MEAL_IMAGE_BYTES
  ) {
    return NextResponse.json(
      { error: "Image request is too large." },
      { status: 413 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Meal-photo analysis is not configured." },
      { status: 503 },
    );
  }

  let formData: FormData | null = null;
  let image: Blob | null = null;
  let imageBytes: ArrayBuffer | null = null;
  let encodedImage: string | null = null;
  let providerRequestBody: string | null = null;
  try {
    formData = await request.formData();
    const entry = formData.get("image");
    if (!(entry instanceof Blob)) {
      return NextResponse.json(
        { error: "A valid image file is required." },
        { status: 400 },
      );
    }
    image = entry;
    if (!isSupportedMealImageType(image.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are supported." },
        { status: 415 },
      );
    }
    if (image.size > MAX_MEAL_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image request is too large." },
        { status: 413 },
      );
    }

    const rateLimit = consumeMealPhotoRateLimit(authentication.uid);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Hourly photo-analysis limit reached. Please try again later.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    imageBytes = await image.arrayBuffer();
    encodedImage = Buffer.from(imageBytes).toString("base64");
    providerRequestBody = JSON.stringify({
      system_instruction: {
        parts: [{ text: ANALYSIS_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              inline_data: {
                mime_type: image.type,
                data: encodedImage,
              },
            },
            {
              text: "Estimate only the visible meal using the required JSON schema.",
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: MAX_RESPONSE_TOKENS,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  estimatedPortion: { type: "string" },
                },
                required: ["name", "estimatedPortion"],
              },
            },
            estimatedCalories: { type: "number" },
            estimatedProteinG: { type: "number" },
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
            "items",
            "estimatedCalories",
            "estimatedProteinG",
            "confidence",
            "assumptions",
          ],
        },
      },
    });
    const model =
      process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MEAL_PHOTO_MODEL;
    const providerResponse = await fetch(
      `${GEMINI_API_ROOT}/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: providerRequestBody,
        cache: "no-store",
      },
    );
    if (providerResponse.status === 429) {
      return NextResponse.json(
        {
          error:
            "Free photo-analysis quota is temporarily exhausted. Please try again later.",
        },
        { status: 429 },
      );
    }
    if (!providerResponse.ok) {
      return NextResponse.json(
        { error: "Meal-photo analysis provider failed." },
        { status: 502 },
      );
    }

    const analysis = sanitizeProviderOutput(
      extractProviderJson(await providerResponse.json()),
      new Date().toISOString(),
    );
    if (!analysis) {
      return NextResponse.json(
        { error: "Meal-photo analysis returned an invalid result." },
        { status: 502 },
      );
    }
    return NextResponse.json({ analysis });
  } catch {
    return NextResponse.json(
      { error: "Meal-photo analysis could not be completed." },
      { status: 502 },
    );
  } finally {
    providerRequestBody = null;
    encodedImage = null;
    imageBytes = null;
    image = null;
    formData = null;
  }
}
