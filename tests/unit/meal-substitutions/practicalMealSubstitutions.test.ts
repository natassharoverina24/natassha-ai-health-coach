import { MEAL_TEMPLATES } from "@/lib/planner";
import {
  PRACTICAL_FOOD_CATALOGUE,
  buildSubstitutionOptions,
  classifyFoodRole,
  getPracticalMealSubstitutes,
  getTemplatePracticalAvailability,
} from "@/lib/meal-substitutions";

describe("practical meal substitutions", () => {
  it("groups common Indonesian foods by their practical role", () => {
    expect(classifyFoodRole("chicken")).toBe("protein");
    expect(classifyFoodRole("white-rice")).toBe("carb");
    expect(classifyFoodRole("mixed-vegetables")).toBe("vegetable-fiber");
    expect(classifyFoodRole("missing-food")).toBeNull();

    expect(getPracticalMealSubstitutes("protein").map((item) => item.label)).toEqual(
      expect.arrayContaining(["Ayam", "Telur", "Tempe", "Tahu", "Ikan"]),
    );
  });

  it("keeps common options before optional options", () => {
    const proteins = getPracticalMealSubstitutes("protein");
    const firstOptional = proteins.findIndex((item) => item.availability === "optional");

    expect(firstOptional).toBeGreaterThan(0);
    expect(proteins.slice(0, firstOptional).every((item) => item.availability === "common")).toBe(true);
    expect(getTemplatePracticalAvailability("fruit-yogurt")).toBe("optional");
    expect(getTemplatePracticalAvailability("eggs-toast")).toBe("common");
  });

  it("uses only approved local nutrition and leaves other foods for confirmation", () => {
    const chicken = PRACTICAL_FOOD_CATALOGUE.find((item) => item.id === "chicken");
    const tuna = PRACTICAL_FOOD_CATALOGUE.find((item) => item.id === "tuna");

    expect(chicken).toMatchObject({
      provenance: "local-catalog",
      nutritionStatus: "approved",
      nutrition: expect.objectContaining({ caloriesKcal: expect.any(Number) }),
    });
    expect(tuna).toMatchObject({
      provenance: "local-catalog",
      nutritionStatus: "needs-confirmation",
      nutrition: null,
    });
  });

  it("builds deterministic role-compatible options for every approved template", () => {
    expect(MEAL_TEMPLATES).toHaveLength(18);
    for (const template of MEAL_TEMPLATES) {
      const first = buildSubstitutionOptions(template.id);
      const second = buildSubstitutionOptions(template.id);
      expect(first).toEqual(second);
      expect(first.length).toBeGreaterThan(0);
      expect(
        first.every((group) => group.options.every((option) => option.role === group.role)),
      ).toBe(true);
    }
  });

  it("returns safe empty output for unknown templates and does not mutate the catalogue", () => {
    const before = JSON.parse(JSON.stringify(PRACTICAL_FOOD_CATALOGUE));
    expect(buildSubstitutionOptions("custom-unknown")).toEqual([]);
    const proteins = getPracticalMealSubstitutes("protein");
    proteins[0].sourceIds.push("test-only");
    if (proteins[0].nutrition) proteins[0].nutrition.caloriesKcal = 1;
    expect(PRACTICAL_FOOD_CATALOGUE).toEqual(before);
    expect(JSON.stringify(PRACTICAL_FOOD_CATALOGUE)).not.toMatch(
      /gemini|groq|openrouter|paid|medical|thyroid/i,
    );
  });
});
