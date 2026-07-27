/**
 * Meal Templates — The Meal Planner's Recipe Source
 * ---------------------------------------------------------------------------
 * Per AI_PLANNING_SPEC.md §3.4: the Meal Planner selects from approved
 * meal templates, never invents nutritional values. Every calorie, protein,
 * carb, fat, and fiber figure here is a defined, verifiable value — the
 * same way every number in CoachDecision traces back to logged data rather
 * than being estimated freely.
 *
 * Templates are tagged with attributes (high-protein, quick-prep,
 * pms-friendly, migraine-safe, etc.) that the Meal Planner's constraint
 * solver uses to filter and rank options — the tags encode which
 * constraints a template satisfies, so the planner never needs to infer
 * suitability from the macros alone.
 *
 * All values are per-serving, for common Indonesian home-cooked or
 * easily-ordered meals, consistent with the nutrition estimates already
 * established in `src/lib/utils/nutritionEstimates.ts` and the confirmed
 * food context in `USER_PROFILE.md` §5.
 */

export type MealSlot = "breakfast" | "lunch" | "snack" | "dinner";

export type MealTag =
  | "high-protein"
  | "quick-prep"
  | "fiber-forward"
  | "pms-friendly"
  | "migraine-safe"
  | "light"
  | "spicy-option"
  | "budget-friendly";

export interface MealTemplate {
  id: string;
  name: string;
  serving: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  /** Which meal slots this template is suitable for. */
  slots: MealSlot[];
  tags: MealTag[];
}

// ---------------------------------------------------------------------------
// Template library
// ---------------------------------------------------------------------------

export const MEAL_TEMPLATES: MealTemplate[] = [
  // ---- Breakfast ----------------------------------------------------------
  {
    id: "oatmeal-banana",
    name: "Oatmeal with banana",
    serving: "1 bowl, ~250g",
    calories: 280,
    proteinG: 8,
    carbsG: 48,
    fatG: 6,
    fiberG: 5,
    slots: ["breakfast"],
    tags: ["quick-prep", "fiber-forward", "migraine-safe", "budget-friendly"],
  },
  {
    id: "eggs-toast",
    name: "Scrambled eggs with toast",
    serving: "2 eggs + 1 slice",
    calories: 310,
    proteinG: 18,
    carbsG: 24,
    fatG: 16,
    fiberG: 1,
    slots: ["breakfast"],
    tags: ["high-protein", "quick-prep", "migraine-safe", "budget-friendly"],
  },
  {
    id: "tempe-rice-breakfast",
    name: "Tempe goreng with rice",
    serving: "2 pcs tempe + rice",
    calories: 350,
    proteinG: 14,
    carbsG: 50,
    fatG: 10,
    fiberG: 4,
    slots: ["breakfast"],
    tags: ["fiber-forward", "budget-friendly"],
  },
  {
    id: "toast-peanut-butter",
    name: "Toast with peanut butter",
    serving: "2 slices + 1 tbsp PB",
    calories: 290,
    proteinG: 10,
    carbsG: 34,
    fatG: 13,
    fiberG: 3,
    slots: ["breakfast"],
    tags: ["quick-prep", "budget-friendly", "migraine-safe"],
  },
  {
    id: "bubur-ayam",
    name: "Bubur ayam (chicken porridge)",
    serving: "1 bowl, ~300g",
    calories: 320,
    proteinG: 20,
    carbsG: 40,
    fatG: 8,
    fiberG: 1,
    slots: ["breakfast"],
    tags: ["high-protein", "migraine-safe", "light"],
  },

  // ---- Lunch / Dinner (shared — these work for either) --------------------
  {
    id: "chicken-rice-veg",
    name: "Grilled chicken with rice & vegetables",
    serving: "100g chicken + 150g rice + veg",
    calories: 480,
    proteinG: 32,
    carbsG: 52,
    fatG: 14,
    fiberG: 4,
    slots: ["lunch", "dinner"],
    tags: ["high-protein", "migraine-safe", "budget-friendly"],
  },
  {
    id: "fish-rice-veg",
    name: "Pan-fried fish with rice & vegetables",
    serving: "100g fish + 150g rice + veg",
    calories: 440,
    proteinG: 28,
    carbsG: 50,
    fatG: 12,
    fiberG: 4,
    slots: ["lunch", "dinner"],
    tags: ["high-protein", "migraine-safe", "budget-friendly"],
  },
  {
    id: "tofu-tempe-rice",
    name: "Tofu & tempe with rice & sayur",
    serving: "1 plate",
    calories: 420,
    proteinG: 22,
    carbsG: 52,
    fatG: 14,
    fiberG: 6,
    slots: ["lunch", "dinner"],
    tags: ["fiber-forward", "budget-friendly", "migraine-safe"],
  },
  {
    id: "egg-rice-sambal",
    name: "Fried egg with rice & sambal",
    serving: "2 eggs + rice",
    calories: 430,
    proteinG: 16,
    carbsG: 50,
    fatG: 18,
    fiberG: 1,
    slots: ["lunch", "dinner"],
    tags: ["quick-prep", "budget-friendly", "spicy-option"],
  },
  {
    id: "soto-ayam",
    name: "Soto ayam (chicken soup)",
    serving: "1 bowl, ~400ml",
    calories: 380,
    proteinG: 24,
    carbsG: 38,
    fatG: 12,
    fiberG: 2,
    slots: ["lunch", "dinner"],
    tags: ["high-protein", "light", "migraine-safe", "spicy-option"],
  },
  {
    id: "nasi-goreng-protein",
    name: "Nasi goreng with egg & chicken",
    serving: "1 plate",
    calories: 520,
    proteinG: 26,
    carbsG: 58,
    fatG: 20,
    fiberG: 2,
    slots: ["lunch", "dinner"],
    tags: ["high-protein", "spicy-option"],
  },
  {
    id: "gado-gado",
    name: "Gado-gado (vegetable salad with peanut sauce)",
    serving: "1 plate",
    calories: 360,
    proteinG: 14,
    carbsG: 32,
    fatG: 20,
    fiberG: 7,
    slots: ["lunch", "dinner"],
    tags: ["fiber-forward", "pms-friendly", "budget-friendly"],
  },
  {
    id: "chicken-soup-sayur",
    name: "Chicken breast with clear soup & vegetables",
    serving: "150g chicken + soup + veg",
    calories: 340,
    proteinG: 36,
    carbsG: 12,
    fatG: 14,
    fiberG: 4,
    slots: ["lunch", "dinner"],
    tags: ["high-protein", "light", "migraine-safe"],
  },

  // ---- Snacks -------------------------------------------------------------
  {
    id: "boiled-eggs-snack",
    name: "Boiled eggs",
    serving: "2 eggs",
    calories: 156,
    proteinG: 12,
    carbsG: 1,
    fatG: 10,
    fiberG: 0,
    slots: ["snack"],
    tags: ["high-protein", "quick-prep", "migraine-safe", "budget-friendly"],
  },
  {
    id: "banana-peanuts",
    name: "Banana with peanuts",
    serving: "1 banana + 20g peanuts",
    calories: 220,
    proteinG: 7,
    carbsG: 30,
    fatG: 10,
    fiberG: 4,
    slots: ["snack"],
    tags: ["fiber-forward", "quick-prep", "pms-friendly", "budget-friendly", "migraine-safe"],
  },
  {
    id: "tempe-chips",
    name: "Keripik tempe (tempe chips)",
    serving: "~50g",
    calories: 200,
    proteinG: 10,
    carbsG: 14,
    fatG: 12,
    fiberG: 3,
    slots: ["snack"],
    tags: ["fiber-forward", "budget-friendly"],
  },
  {
    id: "fruit-yogurt",
    name: "Fruit with plain yogurt",
    serving: "100g fruit + 100g yogurt",
    calories: 130,
    proteinG: 5,
    carbsG: 22,
    fatG: 2,
    fiberG: 2,
    slots: ["snack"],
    tags: ["light", "quick-prep", "pms-friendly", "migraine-safe"],
  },
  {
    id: "edamame-snack",
    name: "Edamame",
    serving: "~100g shelled",
    calories: 120,
    proteinG: 11,
    carbsG: 9,
    fatG: 5,
    fiberG: 5,
    slots: ["snack"],
    tags: ["high-protein", "fiber-forward", "quick-prep", "migraine-safe", "budget-friendly"],
  },
];
