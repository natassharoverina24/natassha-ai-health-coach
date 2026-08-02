import type { MealSlot } from "@/lib/planner";

import type { PracticalMealIdea, WeeklyMealPreferences } from "./types";

export const PRACTICAL_INDONESIAN_MEAL_IDEAS: readonly PracticalMealIdea[] = [
  {
    id: "nasi-telur-sayur",
    name: "Nasi, telur, dan tumis sayur",
    slots: ["breakfast", "lunch", "dinner"],
    roles: ["protein", "carb", "vegetable-fiber"],
    ingredientIds: ["egg", "white-rice", "mixed-vegetables"],
    availability: "common",
    preparation: "quick",
    reason: "Bahannya umum dan gampang disiapkan di rumah atau dicari di warung.",
    searchKeywords: "nasi telur tumis sayur",
    provenance: "local-catalog",
    nutritionStatus: "needs-confirmation",
  },
  {
    id: "ayam-kecap-nasi-sayur",
    name: "Ayam kecap, nasi, dan sayur",
    slots: ["lunch", "dinner"],
    roles: ["protein", "carb", "vegetable-fiber"],
    ingredientIds: ["chicken", "white-rice", "mixed-vegetables"],
    availability: "common",
    preparation: "simple",
    reason: "Menu rumahan yang praktis dan komponennya mudah ditemukan.",
    searchKeywords: "ayam kecap nasi sayur simple",
    provenance: "local-catalog",
    nutritionStatus: "needs-confirmation",
  },
  {
    id: "ikan-bakar-nasi-lalapan",
    name: "Ikan bakar, nasi, dan lalapan",
    slots: ["lunch", "dinner"],
    roles: ["protein", "carb", "vegetable-fiber"],
    ingredientIds: ["fish", "white-rice", "lalapan"],
    availability: "common",
    preparation: "simple",
    reason: "Pilihan Indonesia yang mudah dicari di warung makan.",
    searchKeywords: "ikan bakar nasi lalapan simple",
    provenance: "local-catalog",
    nutritionStatus: "needs-confirmation",
  },
  {
    id: "tempe-tahu-capcay-nasi",
    name: "Tempe, tahu, capcay, dan nasi",
    slots: ["lunch", "dinner"],
    roles: ["protein", "carb", "vegetable-fiber"],
    ingredientIds: ["tempe", "tofu", "capcay", "white-rice"],
    availability: "common",
    preparation: "simple",
    reason: "Bahan lokalnya mudah didapat dan cocok untuk masak sederhana.",
    searchKeywords: "tempe tahu capcay nasi",
    provenance: "local-catalog",
    nutritionStatus: "needs-confirmation",
  },
  {
    id: "roti-telur-pisang",
    name: "Roti gandum, telur, dan pisang",
    slots: ["breakfast"],
    roles: ["protein", "carb", "fruit-snack"],
    ingredientIds: ["whole-wheat-bread", "egg", "banana"],
    availability: "common",
    preparation: "quick",
    reason: "Cepat dibuat dengan bahan minimarket yang mudah ditemukan.",
    searchKeywords: "sarapan roti telur pisang simple",
    provenance: "local-catalog",
    nutritionStatus: "needs-confirmation",
  },
  {
    id: "ubi-telur",
    name: "Ubi kukus dan telur",
    slots: ["breakfast", "snack"],
    roles: ["protein", "carb"],
    ingredientIds: ["sweet-potato", "egg"],
    availability: "common",
    preparation: "quick",
    reason: "Sederhana, mudah dibawa, dan bahannya gampang dicari.",
    searchKeywords: "ubi kukus telur simple",
    provenance: "local-catalog",
    nutritionStatus: "needs-confirmation",
  },
  {
    id: "pepaya-kacang",
    name: "Pepaya dan kacang",
    slots: ["snack"],
    roles: ["fruit-snack"],
    ingredientIds: ["papaya", "peanuts"],
    availability: "common",
    preparation: "quick",
    reason: "Snack praktis dengan bahan yang umum di Indonesia.",
    searchKeywords: "snack pepaya kacang",
    provenance: "local-catalog",
    nutritionStatus: "needs-confirmation",
  },
] as const;

export function getLocalMealIdeaAlternatives(
  slot: MealSlot,
  currentId: string,
  preferences: WeeklyMealPreferences,
): PracticalMealIdea[] {
  const disliked = new Set(preferences.dislikedFoodIds);
  const liked = new Set(preferences.likedFoodIds);
  return PRACTICAL_INDONESIAN_MEAL_IDEAS.filter(
    (idea) =>
      idea.id !== currentId &&
      idea.slots.includes(slot) &&
      !idea.ingredientIds.some((id) => disliked.has(id)),
  )
    .sort((left, right) => {
      const leftLiked = left.ingredientIds.some((id) => liked.has(id)) ? 1 : 0;
      const rightLiked = right.ingredientIds.some((id) => liked.has(id)) ? 1 : 0;
      const leftQuick = preferences.quickMealsPreferred && left.preparation === "quick" ? 1 : 0;
      const rightQuick = preferences.quickMealsPreferred && right.preparation === "quick" ? 1 : 0;
      return rightLiked - leftLiked || rightQuick - leftQuick;
    })
    .map((idea) => ({ ...idea, slots: [...idea.slots], roles: [...idea.roles], ingredientIds: [...idea.ingredientIds] }));
}
