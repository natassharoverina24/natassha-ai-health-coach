import { NextResponse } from "next/server";

import {
  DEFAULT_GEMINI_WEEKLY_MEAL_MODEL,
  DEFAULT_GROQ_WEEKLY_MEAL_MODEL,
  DEFAULT_OPENROUTER_WEEKLY_MEAL_MODEL,
  GeminiWeeklyMealProvider,
  GroqWeeklyMealProvider,
  OpenRouterWeeklyMealProvider,
  generateWeeklyMealIdeas,
  type WeeklyMealIdeaInput,
} from "@/lib/ai/server/weeklyMealIdeas";
import { authenticateFirebaseRequest } from "@/lib/firebase/serverAuth";
import type { MealSlot } from "@/lib/planner";

const SLOTS = new Set<MealSlot>(["breakfast", "lunch", "snack", "dinner"]);
const MAX_TEXT = 120;
const REQUESTS_PER_HOUR = 5;
const WINDOW_MS = 60 * 60 * 1_000;
const rateWindows = new Map<string, { startedAt: number; count: number }>();

export function resetWeeklyMealIdeaRateLimitsForTests() { rateWindows.clear(); }

function allowAiRequest(userId: string, now = Date.now()): boolean {
  const current = rateWindows.get(userId);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    rateWindows.set(userId, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= REQUESTS_PER_HOUR) return false;
  current.count += 1;
  return true;
}

function safeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= MAX_TEXT ? normalized : null;
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const items = value.map(safeText);
  return items.some((item) => !item) ? null : items as string[];
}

export async function POST(request: Request) {
  const auth = await authenticateFirebaseRequest(request);
  if (auth.status === "unauthenticated") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (auth.status !== "authenticated") return NextResponse.json({ status: "local-fallback" }, { status: 200 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const value = body as Record<string, unknown>;
  const slot = value.slot as MealSlot;
  const currentMealName = safeText(value.currentMealName);
  const likedFoodIds = stringList(value.likedFoodIds);
  const dislikedFoodIds = stringList(value.dislikedFoodIds);
  if (!SLOTS.has(slot) || !currentMealName || !likedFoodIds || !dislikedFoodIds || typeof value.quickMealsPreferred !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const input: WeeklyMealIdeaInput = { slot, currentMealName, likedFoodIds, dislikedFoodIds, quickMealsPreferred: value.quickMealsPreferred };
  if (!allowAiRequest(auth.uid)) return NextResponse.json({ status: "local-fallback" });
  const result = await generateWeeklyMealIdeas(input, [
    new GeminiWeeklyMealProvider({ apiKey: process.env.GEMINI_API_KEY ?? "", model: DEFAULT_GEMINI_WEEKLY_MEAL_MODEL }),
    new GroqWeeklyMealProvider({ apiKey: process.env.GROQ_API_KEY ?? "", model: process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_WEEKLY_MEAL_MODEL }),
    new OpenRouterWeeklyMealProvider({ apiKey: process.env.OPENROUTER_API_KEY ?? "", model: DEFAULT_OPENROUTER_WEEKLY_MEAL_MODEL }),
  ]);
  return NextResponse.json(result);
}
