/**
 * meal_photos repository
 * Photo metadata for meals; the binary lives in Firebase Storage
 * (see src/lib/firebase/storage.ts), this collection just indexes it.
 */
import { orderBy, where } from "firebase/firestore";

import { createRepository } from "./baseRepository";
import { COLLECTIONS, type MealPhoto } from "@/types/firestore";

const base = createRepository<MealPhoto>(COLLECTIONS.mealPhotos);

export const mealPhotosRepository = {
  ...base,

  listForMeal(mealId: string) {
    return base.list([where("mealId", "==", mealId), orderBy("createdAt", "asc")]);
  },

  subscribeForMeal(
    mealId: string,
    onData: (items: MealPhoto[]) => void,
    onError?: (error: Error) => void,
  ) {
    return base.subscribe(
      [where("mealId", "==", mealId), orderBy("createdAt", "asc")],
      onData,
      onError,
    );
  },

  listUnanalyzedForUser(userId: string) {
    return base.list([
      where("userId", "==", userId),
      where("aiAnalyzed", "==", false),
    ]);
  },
};
