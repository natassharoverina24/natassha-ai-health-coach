import type { MealSlot } from "@/lib/planner";
import { validateAiMealIdea } from "@/lib/weekly-meal-ideas";
import type {
  MealIdeaProvider,
  PracticalMealIdea,
} from "@/lib/weekly-meal-ideas";

export interface WeeklyMealIdeaInput {
  slot: MealSlot;
  currentMealName: string;
  likedFoodIds: string[];
  dislikedFoodIds: string[];
  quickMealsPreferred: boolean;
}

export type WeeklyMealProviderResult =
  | { status: "success"; idea: PracticalMealIdea }
  | { status: "failed"; reason: "quota" | "timeout" | "unavailable" | "invalid-output" };

export interface WeeklyMealIdeaProvider {
  readonly name: MealIdeaProvider;
  readonly model: string;
  isConfigured(): boolean;
  generate(input: WeeklyMealIdeaInput): Promise<WeeklyMealProviderResult>;
}

interface ProviderOptions {
  apiKey: string;
  model: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 8_000;
const SYSTEM_PROMPT = `Suggest exactly one practical Indonesian meal variation.
Return JSON only: {"name":"","roles":["protein","carb","vegetable-fiber"],"ingredientIds":["chicken","white-rice","mixed-vegetables"],"availability":"common","preparation":"quick","reason":"","searchKeywords":""}.
Use ordinary ingredients available from Indonesian warung, minimarket, supermarket, office food, or simple home cooking.
Do not output calories, macros, targets, portions, medical claims, diagnoses, restrictions, supplements, medication, fasting, meal skipping, or coaching decisions.`;

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return null;
  try { return JSON.parse(value); } catch { return null; }
}

function geminiJson(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  const candidates = (value as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || !candidates[0]) return null;
  const parts = ((candidates[0] as { content?: { parts?: unknown } }).content?.parts);
  if (!Array.isArray(parts)) return null;
  return parseJson(parts.map((part) => part && typeof part === "object" ? (part as { text?: unknown }).text ?? "" : "").join(""));
}

function compatibleJson(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0]) return null;
  const content = (choices[0] as { message?: { content?: unknown } }).message?.content;
  return parseJson(content);
}

async function requestWithTimeout(fetcher: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetcher(url, { ...init, signal: controller.signal }); }
  catch { return null; }
  finally { clearTimeout(timeout); }
}

function safeProviderInput(input: WeeklyMealIdeaInput) {
  return {
    slot: input.slot,
    currentMealName: input.currentMealName,
    likedFoodIds: input.likedFoodIds.slice(0, 20),
    dislikedFoodIds: input.dislikedFoodIds.slice(0, 20),
    quickMealsPreferred: input.quickMealsPreferred,
  };
}

abstract class BaseProvider implements WeeklyMealIdeaProvider {
  abstract readonly name: MealIdeaProvider;
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
  isConfigured() { return this.apiKey.length > 0; }
  abstract generate(input: WeeklyMealIdeaInput): Promise<WeeklyMealProviderResult>;
  protected validated(value: unknown, input: WeeklyMealIdeaInput): WeeklyMealProviderResult {
    const idea = validateAiMealIdea(value, input.slot, this.name, this.model, input.dislikedFoodIds);
    return idea ? { status: "success", idea } : { status: "failed", reason: "invalid-output" };
  }
}

export const DEFAULT_GEMINI_WEEKLY_MEAL_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
export const DEFAULT_GROQ_WEEKLY_MEAL_MODEL = "llama-3.1-8b-instant";
export const DEFAULT_OPENROUTER_WEEKLY_MEAL_MODEL = "openrouter/free";

export class GeminiWeeklyMealProvider extends BaseProvider {
  readonly name = "gemini" as const;
  async generate(input: WeeklyMealIdeaInput): Promise<WeeklyMealProviderResult> {
    if (!this.isConfigured()) return { status: "failed", reason: "unavailable" };
    const response = await requestWithTimeout(this.fetcher,
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: JSON.stringify(safeProviderInput(input)) }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 500, responseMimeType: "application/json" },
        }),
        cache: "no-store",
      }, this.timeoutMs);
    if (!response) return { status: "failed", reason: "timeout" };
    if (response.status === 429) return { status: "failed", reason: "quota" };
    if (!response.ok) return { status: "failed", reason: "unavailable" };
    return this.validated(geminiJson(await response.json().catch(() => null)), input);
  }
}

abstract class CompatibleProvider extends BaseProvider {
  protected abstract readonly endpoint: string;
  async generate(input: WeeklyMealIdeaInput): Promise<WeeklyMealProviderResult> {
    if (!this.isConfigured()) return { status: "failed", reason: "unavailable" };
    const response = await requestWithTimeout(this.fetcher, this.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.4,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: JSON.stringify(safeProviderInput(input)) }],
      }),
      cache: "no-store",
    }, this.timeoutMs);
    if (!response) return { status: "failed", reason: "timeout" };
    if (response.status === 429) return { status: "failed", reason: "quota" };
    if (!response.ok) return { status: "failed", reason: "unavailable" };
    return this.validated(compatibleJson(await response.json().catch(() => null)), input);
  }
}

export class GroqWeeklyMealProvider extends CompatibleProvider {
  readonly name = "groq" as const;
  protected readonly endpoint = "https://api.groq.com/openai/v1/chat/completions";
}

export class OpenRouterWeeklyMealProvider extends CompatibleProvider {
  readonly name = "openrouter" as const;
  protected readonly endpoint = "https://openrouter.ai/api/v1/chat/completions";
}

export async function generateWeeklyMealIdeas(
  input: WeeklyMealIdeaInput,
  providers: readonly WeeklyMealIdeaProvider[],
): Promise<{ status: "success"; idea: PracticalMealIdea } | { status: "local-fallback" }> {
  for (const provider of providers) {
    if (!provider.isConfigured()) continue;
    const result = await provider.generate(input);
    if (result.status === "success") return result;
  }
  return { status: "local-fallback" };
}
