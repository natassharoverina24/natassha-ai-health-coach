import { OFFICE_LUNCH_ITEMS, QUICK_LOG_FOODS, sumMacros, WATER_QUICK_AMOUNTS_ML } from "@/lib/utils/nutritionEstimates";

describe("OFFICE_LUNCH_ITEMS", () => {
  it("includes every item named in the office lunch quick-input spec", () => {
    const labels = OFFICE_LUNCH_ITEMS.map((item) => item.label);
    expect(labels).toEqual([
      "Rice",
      "Chicken",
      "Fish",
      "Egg",
      "Tempe",
      "Tofu",
      "Vegetables",
      "Soup",
      "Fruit",
      "Dessert",
      "Sweet Drink",
    ]);
  });

  it("gives every item non-negative macro estimates", () => {
    for (const item of OFFICE_LUNCH_ITEMS) {
      expect(item.macros.calories).toBeGreaterThan(0);
      expect(item.macros.proteinG).toBeGreaterThanOrEqual(0);
      expect(item.macros.carbsG).toBeGreaterThanOrEqual(0);
      expect(item.macros.fatG).toBeGreaterThanOrEqual(0);
      expect(item.macros.fiberG ?? 0).toBeGreaterThanOrEqual(0);
    }
  });

  it("has a unique key per item", () => {
    const keys = OFFICE_LUNCH_ITEMS.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("QUICK_LOG_FOODS", () => {
  it("includes every item named in the Quick Log spec", () => {
    const labels = QUICK_LOG_FOODS.map((item) => item.label);
    expect(labels).toEqual(["Coffee with Milk", "Rice", "Chicken", "Egg", "Vegetables", "Fruit"]);
  });
});

describe("sumMacros", () => {
  it("sums calories, protein, carbs, fat, and fiber across items", () => {
    const total = sumMacros([
      { calories: 100, proteinG: 5, carbsG: 10, fatG: 2, fiberG: 1 },
      { calories: 200, proteinG: 15, carbsG: 20, fatG: 4, fiberG: 3 },
    ]);
    expect(total).toEqual({ calories: 300, proteinG: 20, carbsG: 30, fatG: 6, fiberG: 4 });
  });

  it("treats a null fiber value as zero rather than propagating null", () => {
    const total = sumMacros([{ calories: 50, proteinG: 1, carbsG: 5, fatG: 1, fiberG: null }]);
    expect(total.fiberG).toBe(0);
  });

  it("returns an all-zero total for an empty list", () => {
    expect(sumMacros([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 });
  });
});

describe("WATER_QUICK_AMOUNTS_ML", () => {
  it("matches the four quick-add buttons from the spec", () => {
    expect(WATER_QUICK_AMOUNTS_ML).toEqual([250, 500, 750, 1000]);
  });
});
