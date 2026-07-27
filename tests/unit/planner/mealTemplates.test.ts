import { MEAL_TEMPLATES, type MealSlot } from "@/lib/planner/mealTemplates";

describe("MEAL_TEMPLATES integrity", () => {
  it("has at least 3 templates for each meal slot", () => {
    const slots: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];
    for (const slot of slots) {
      const count = MEAL_TEMPLATES.filter((t) => t.slots.includes(slot)).length;
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it("has unique IDs across all templates", () => {
    const ids = MEAL_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no template with zero or negative calories", () => {
    for (const t of MEAL_TEMPLATES) {
      expect(t.calories).toBeGreaterThan(0);
    }
  });

  it("has no template with negative macros", () => {
    for (const t of MEAL_TEMPLATES) {
      expect(t.proteinG).toBeGreaterThanOrEqual(0);
      expect(t.carbsG).toBeGreaterThanOrEqual(0);
      expect(t.fatG).toBeGreaterThanOrEqual(0);
      expect(t.fiberG).toBeGreaterThanOrEqual(0);
    }
  });

  it("has at least one high-protein option for breakfast, lunch, snack, and dinner", () => {
    const slots: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];
    for (const slot of slots) {
      const hp = MEAL_TEMPLATES.filter((t) => t.slots.includes(slot) && t.tags.includes("high-protein"));
      expect(hp.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("has at least one migraine-safe option for every slot", () => {
    const slots: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];
    for (const slot of slots) {
      const safe = MEAL_TEMPLATES.filter((t) => t.slots.includes(slot) && t.tags.includes("migraine-safe"));
      expect(safe.length).toBeGreaterThanOrEqual(1);
    }
  });
});
