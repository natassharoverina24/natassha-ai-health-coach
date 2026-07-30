export type NutritionConfidence = "low" | "medium" | "high";

export interface NutritionEstimationInput {
  foodName: string;
  quantity: string | null;
  portion: string | null;
}

export interface ValidatedNutritionEstimate {
  grams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  confidence: NutritionConfidence;
  assumptions: string[];
}

export type NutritionProviderFailureReason =
  | "quota-exhausted"
  | "timeout"
  | "unavailable"
  | "invalid-output";

export type NutritionProviderResult =
  | {
      status: "success";
      estimate: ValidatedNutritionEstimate;
      provider: "gemini" | "groq" | "openrouter";
      model: string;
    }
  | { status: "invalid-input" }
  | { status: "failed"; reason: NutritionProviderFailureReason };

export interface NutritionEstimationProvider {
  readonly name: "gemini" | "groq" | "openrouter";
  readonly model: string;
  isConfigured(): boolean;
  estimate(input: NutritionEstimationInput): Promise<NutritionProviderResult>;
}

interface ProviderOptions {
  apiKey: string;
  model: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

const MAX_TEXT_LENGTH = 240;
const MAX_ASSUMPTIONS = 10;
const DEFAULT_TIMEOUT_MS = 8_000;
const PROHIBITED_GUIDANCE =
  /\b(thyroid|diagnos(?:e|is)|treat(?:ment)?|cure|medication|supplement|prescri(?:be|ption)|medical advice|you should|recommend(?:ation)?|avoid eating|diet plan)\b/i;

const SYSTEM_PROMPT = `Estimate nutrition only for the supplied food and portion.
Return JSON only with this exact shape:
{"grams":1,"calories":1,"proteinG":0,"carbsG":0,"fatG":0,"fiberG":null,"confidence":"low","assumptions":[]}
Treat every value as uncertain. Calories and grams must be greater than zero.
Do not provide recommendations, coaching decisions, diagnoses, medical claims, diets, restrictions, supplements, or medication guidance.`;

function safeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_TEXT_LENGTH
    ? trimmed
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

export function validateNutritionEstimationInput(
  input: NutritionEstimationInput,
): boolean {
  return (
    safeText(input.foodName) !== null &&
    (input.quantity === null || safeText(input.quantity) !== null) &&
    (input.portion === null || safeText(input.portion) !== null)
  );
}

export function validateNutritionProviderOutput(
  value: unknown,
): ValidatedNutritionEstimate | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const grams = safeNumber(
    candidate.grams ?? candidate.servingGrams,
    0.1,
  );
  const calories = safeNumber(candidate.calories, 0.1);
  const proteinG = safeNumber(candidate.proteinG, 0);
  const carbsG = safeNumber(candidate.carbsG, 0);
  const fatG = safeNumber(candidate.fatG, 0);
  const fiberG =
    candidate.fiberG === null || candidate.fiberG === undefined
      ? null
      : safeNumber(candidate.fiberG, 0);
  if (
    grams === null ||
    calories === null ||
    proteinG === null ||
    carbsG === null ||
    fatG === null ||
    (candidate.fiberG !== null &&
      candidate.fiberG !== undefined &&
      fiberG === null) ||
    !["low", "medium", "high"].includes(String(candidate.confidence)) ||
    !Array.isArray(candidate.assumptions) ||
    candidate.assumptions.length > MAX_ASSUMPTIONS
  ) {
    return null;
  }
  const assumptions = candidate.assumptions.map((item) => safeText(item));
  if (
    assumptions.some(
      (item) => item === null || PROHIBITED_GUIDANCE.test(item),
    )
  ) {
    return null;
  }
  return {
    grams,
    calories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    confidence: candidate.confidence as NutritionConfidence,
    assumptions: assumptions as string[],
  };
}

function parseJsonText(value: unknown): unknown {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractGeminiOutput(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  const candidates = (value as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const content = (candidates[0] as { content?: unknown }).content;
  if (!content || typeof content !== "object") return null;
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .map((part) =>
      part && typeof part === "object"
        ? (part as { text?: unknown }).text
        : null,
    )
    .filter((part): part is string => typeof part === "string")
    .join("");
  return parseJsonText(text);
}

function extractOpenAiCompatibleOutput(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  return parseJsonText((message as { content?: unknown }).content);
}

function providerInput(input: NutritionEstimationInput) {
  return {
    foodName: input.foodName,
    quantity: input.quantity,
    portion: input.portion,
  };
}

async function fetchWithTimeout(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

abstract class BaseNutritionProvider
  implements NutritionEstimationProvider
{
  abstract readonly name: "gemini" | "groq" | "openrouter";
  readonly model: string;
  protected readonly apiKey: string;
  protected readonly fetcher: typeof fetch;
  protected readonly timeoutMs: number;

  constructor(options: ProviderOptions) {
    this.apiKey = options.apiKey.trim();
    this.model = options.model;
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  isConfigured() {
    return this.apiKey.length > 0;
  }

  abstract estimate(
    input: NutritionEstimationInput,
  ): Promise<NutritionProviderResult>;

}

export const DEFAULT_GEMINI_NUTRITION_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_GROQ_NUTRITION_MODEL = "llama-3.1-8b-instant";
export const OPENROUTER_FREE_NUTRITION_MODEL = "openrouter/free";

export class GeminiNutritionProvider extends BaseNutritionProvider {
  readonly name = "gemini" as const;

  async estimate(
    input: NutritionEstimationInput,
  ): Promise<NutritionProviderResult> {
    if (!validateNutritionEstimationInput(input)) {
      return { status: "invalid-input" };
    }
    if (!this.isConfigured()) {
      return { status: "failed", reason: "unavailable" };
    }
    const response = await fetchWithTimeout(
      this.fetcher,
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              role: "user",
              parts: [{ text: JSON.stringify(providerInput(input)) }],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 500,
            responseMimeType: "application/json",
          },
        }),
        cache: "no-store",
      },
      this.timeoutMs,
    );
    if (!response) return { status: "failed", reason: "timeout" };
    if (response.status === 429) {
      return { status: "failed", reason: "quota-exhausted" };
    }
    if (!response.ok) return { status: "failed", reason: "unavailable" };
    const estimate = validateNutritionProviderOutput(
      extractGeminiOutput(await response.json().catch(() => null)),
    );
    return estimate
      ? {
          status: "success",
          estimate,
          provider: this.name,
          model: this.model,
        }
      : { status: "failed", reason: "invalid-output" };
  }
}

abstract class OpenAiCompatibleNutritionProvider extends BaseNutritionProvider {
  protected abstract readonly endpoint: string;

  async estimate(
    input: NutritionEstimationInput,
  ): Promise<NutritionProviderResult> {
    if (!validateNutritionEstimationInput(input)) {
      return { status: "invalid-input" };
    }
    if (!this.isConfigured()) {
      return { status: "failed", reason: "unavailable" };
    }
    const response = await fetchWithTimeout(
      this.fetcher,
      this.endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          max_tokens: 500,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: JSON.stringify(providerInput(input)),
            },
          ],
          response_format: { type: "json_object" },
        }),
        cache: "no-store",
      },
      this.timeoutMs,
    );
    if (!response) return { status: "failed", reason: "timeout" };
    if (response.status === 429) {
      return { status: "failed", reason: "quota-exhausted" };
    }
    if (!response.ok) return { status: "failed", reason: "unavailable" };
    const estimate = validateNutritionProviderOutput(
      extractOpenAiCompatibleOutput(
        await response.json().catch(() => null),
      ),
    );
    return estimate
      ? {
          status: "success",
          estimate,
          provider: this.name,
          model: this.model,
        }
      : { status: "failed", reason: "invalid-output" };
  }
}

export class GroqNutritionProvider extends OpenAiCompatibleNutritionProvider {
  readonly name = "groq" as const;
  protected readonly endpoint =
    "https://api.groq.com/openai/v1/chat/completions";
}

export class OpenRouterNutritionProvider extends OpenAiCompatibleNutritionProvider {
  readonly name = "openrouter" as const;
  protected readonly endpoint =
    "https://openrouter.ai/api/v1/chat/completions";
}

export interface NutritionFallbackOptions {
  userId: string;
  providers: readonly NutritionEstimationProvider[];
  allowProviderRequest?: (
    userId: string,
    provider: NutritionEstimationProvider["name"],
  ) => boolean;
}

export type NutritionFallbackResult =
  | Extract<NutritionProviderResult, { status: "success" }>
  | { status: "invalid-input" }
  | { status: "unavailable" };

export async function estimateNutritionWithFallback(
  input: NutritionEstimationInput,
  options: NutritionFallbackOptions,
): Promise<NutritionFallbackResult> {
  if (!validateNutritionEstimationInput(input)) {
    return { status: "invalid-input" };
  }
  for (const provider of options.providers) {
    if (!provider.isConfigured()) continue;
    logProviderEvent("attempted", provider.name);
    if (
      options.allowProviderRequest &&
      !options.allowProviderRequest(options.userId, provider.name)
    ) {
      logProviderEvent("failed", provider.name, "quota-exhausted");
      continue;
    }
    const result = await provider.estimate(input);
    if (result.status === "success") {
      logProviderEvent("succeeded", provider.name);
      return result;
    }
    if (result.status === "invalid-input") return result;
    logProviderEvent("failed", provider.name, result.reason);
  }
  return { status: "unavailable" };
}

function logProviderEvent(
  event: "attempted" | "succeeded" | "failed",
  provider: NutritionEstimationProvider["name"],
  errorCode?: NutritionProviderFailureReason,
) {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[nutrition-estimation]", {
    event,
    provider,
    ...(errorCode ? { errorCode } : {}),
  });
}
