import {
  GeminiWeeklyMealProvider,
  generateWeeklyMealIdeas,
  type WeeklyMealIdeaProvider,
} from "@/lib/ai/server/weeklyMealIdeas";

const input = {
  slot: "lunch" as const,
  currentMealName: "Ayam nasi sayur",
  likedFoodIds: [],
  dislikedFoodIds: [],
  quickMealsPreferred: true,
};

const validIdea = {
  name: "Ikan nasi lalapan",
  roles: ["protein", "carb", "vegetable-fiber"],
  ingredientIds: ["fish", "white-rice", "lalapan"],
  availability: "common",
  preparation: "quick",
  reason: "Bahan mudah dicari di Indonesia.",
  searchKeywords: "ikan nasi lalapan simple",
};

function provider(name: WeeklyMealIdeaProvider["name"], result: Awaited<ReturnType<WeeklyMealIdeaProvider["generate"]>>): WeeklyMealIdeaProvider {
  return { name, model: `${name}-free`, isConfigured: () => true, generate: jest.fn().mockResolvedValue(result) };
}

describe("weekly meal idea free providers", () => {
  it("returns local fallback when no provider is configured", async () => {
    const unavailable = provider("gemini", { status: "failed", reason: "unavailable" });
    unavailable.isConfigured = () => false;
    await expect(generateWeeklyMealIdeas(input, [unavailable])).resolves.toEqual({ status: "local-fallback" });
    expect(unavailable.generate).not.toHaveBeenCalled();
  });

  it("stops after the first successful free provider", async () => {
    const idea = { id: "ai-gemini-ikan", name: "Ikan", slots: ["lunch" as const], roles: ["protein" as const], ingredientIds: ["fish"], availability: "common" as const, preparation: "quick" as const, reason: "Praktis.", searchKeywords: "ikan simple", provenance: "ai-assisted" as const, provider: "gemini" as const, model: "gemini-free", nutritionStatus: "needs-confirmation" as const };
    const gemini = provider("gemini", { status: "success", idea });
    const groq = provider("groq", { status: "failed", reason: "unavailable" });
    await expect(generateWeeklyMealIdeas(input, [gemini, groq])).resolves.toEqual({ status: "success", idea });
    expect(groq.generate).not.toHaveBeenCalled();
  });

  it("falls through quota, timeout, and invalid output to the next provider", async () => {
    const gemini = provider("gemini", { status: "failed", reason: "quota" });
    const groq = provider("groq", { status: "failed", reason: "timeout" });
    const openrouter = provider("openrouter", { status: "failed", reason: "invalid-output" });
    await expect(generateWeeklyMealIdeas(input, [gemini, groq, openrouter])).resolves.toEqual({ status: "local-fallback" });
    expect(gemini.generate).toHaveBeenCalledTimes(1);
    expect(groq.generate).toHaveBeenCalledTimes(1);
    expect(openrouter.generate).toHaveBeenCalledTimes(1);
  });

  it("validates provider output before returning it", async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(validIdea) }] } }] }) });
    const gemini = new GeminiWeeklyMealProvider({ apiKey: "test-key", model: "gemini-free", fetcher });
    await expect(gemini.generate(input)).resolves.toMatchObject({ status: "success", idea: { provider: "gemini", nutritionStatus: "needs-confirmation" } });
    const invalidFetcher = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ...validIdea, calories: 450 }) }] } }] }) });
    await expect(new GeminiWeeklyMealProvider({ apiKey: "test-key", model: "gemini-free", fetcher: invalidFetcher }).generate(input)).resolves.toEqual({ status: "failed", reason: "invalid-output" });
  });
});
