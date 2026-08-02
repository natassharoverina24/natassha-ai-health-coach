import {
  buildTikTokRecipeSearchUrl,
  getLocalMealIdeaAlternatives,
  readRecipeLink,
  readWeeklyMealPreferences,
  saveRecipeLink,
  saveWeeklyMealPreferences,
  validateAiMealIdea,
  validateRecipeUrl,
} from "@/lib/weekly-meal-ideas";

describe("practical weekly meal ideas", () => {
  beforeEach(() => window.localStorage.clear());

  it("works from the local Indonesian catalogue without an AI key", () => {
    const ideas = getLocalMealIdeaAlternatives("lunch", "current", {
      likedFoodIds: [], dislikedFoodIds: [], quickMealsPreferred: false,
    });
    expect(ideas.length).toBeGreaterThan(2);
    expect(ideas.every((idea) => idea.provenance === "local-catalog")).toBe(true);
    expect(ideas.map((idea) => idea.name)).toEqual(expect.arrayContaining(["Ayam kecap, nasi, dan sayur", "Ikan bakar, nasi, dan lalapan"]));
  });

  it("prioritizes liked ingredients and avoids disliked ingredients", () => {
    const ideas = getLocalMealIdeaAlternatives("lunch", "current", {
      likedFoodIds: ["fish"], dislikedFoodIds: ["chicken"], quickMealsPreferred: false,
    });
    expect(ideas[0]?.ingredientIds).toContain("fish");
    expect(ideas.some((idea) => idea.ingredientIds.includes("chicken"))).toBe(false);
  });

  it("persists only the local preference record", () => {
    saveWeeklyMealPreferences("u1", { likedFoodIds: ["egg"], dislikedFoodIds: ["fish"], quickMealsPreferred: true });
    expect(readWeeklyMealPreferences("u1")).toEqual({ likedFoodIds: ["egg"], dislikedFoodIds: ["fish"], quickMealsPreferred: true });
  });

  it("validates a practical AI idea but rejects macros, fancy food, unsafe claims, and dislikes", () => {
    const safe = { name: "Nasi ayam sayur", roles: ["protein", "carb", "vegetable-fiber"], ingredientIds: ["chicken", "white-rice", "mixed-vegetables"], reason: "Bahannya mudah dicari di warung.", searchKeywords: "nasi ayam sayur simple" };
    expect(validateAiMealIdea(safe, "lunch", "gemini", "free-model")).toMatchObject({ provenance: "ai-assisted", provider: "gemini", nutritionStatus: "needs-confirmation" });
    expect(validateAiMealIdea({ ...safe, calories: 400 }, "lunch", "gemini", "free-model")).toBeNull();
    expect(validateAiMealIdea({ ...safe, name: "Wagyu truffle rice" }, "lunch", "gemini", "free-model")).toBeNull();
    expect(validateAiMealIdea({ ...safe, reason: "This cures thyroid disease" }, "lunch", "gemini", "free-model")).toBeNull();
    expect(validateAiMealIdea(safe, "lunch", "gemini", "free-model", ["chicken"])).toBeNull();
  });

  it("builds a TikTok search URL without fetching and supports a manual URL override", () => {
    const auto = buildTikTokRecipeSearchUrl("Soto ayam");
    expect(auto).toContain("tiktok.com/search");
    expect(decodeURIComponent(auto)).toContain("Soto ayam resep diet simple Indonesia");
    expect(validateRecipeUrl("javascript:alert(1)")).toBeNull();
    expect(validateRecipeUrl("not a link")).toBeNull();
    const url = validateRecipeUrl("https://www.youtube.com/watch?v=abc");
    expect(url).toBe("https://www.youtube.com/watch?v=abc");
    saveRecipeLink({ userId: "u1", date: "2026-08-02", slot: "lunch", url: url!, savedAt: "2026-08-02T10:00:00.000Z" });
    expect(readRecipeLink("u1", "2026-08-02", "lunch")?.url).toBe(url);
  });
});
