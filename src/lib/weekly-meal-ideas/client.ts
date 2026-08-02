import type { WeeklyMealIdeaInput } from "@/lib/ai/server/weeklyMealIdeas";
import type { MealIdeaGenerationResult, PracticalMealIdea } from "./types";

export async function requestAiWeeklyMealIdea(input: WeeklyMealIdeaInput): Promise<MealIdeaGenerationResult> {
  const { getCurrentUserIdToken } = await import("@/lib/firebase/auth");
  const token = await getCurrentUserIdToken();
  if (!token) return { status: "local-fallback", reason: "unavailable" };
  try {
    const response = await fetch("/api/ai/weekly-meal-ideas", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) return { status: "local-fallback", reason: "unavailable" };
    const result = await response.json() as { status?: unknown; idea?: unknown };
    if (result.status === "success" && result.idea && typeof result.idea === "object") {
      return { status: "success", idea: result.idea as PracticalMealIdea };
    }
    return { status: "local-fallback", reason: "unconfigured" };
  } catch {
    return { status: "local-fallback", reason: "unavailable" };
  }
}
