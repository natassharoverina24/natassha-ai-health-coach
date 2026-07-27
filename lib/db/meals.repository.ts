/**
 * meals repository
 * Logged meals (breakfast/lunch/dinner/snack), each with a macro breakdown.
 */
import { limit as fbLimit, orderBy, where } from "firebase/firestore";

import { createRepository } from "./baseRepository";
import { COLLECTIONS, type MealEntry } from "@/types/firestore";

const base = createRepository<MealEntry>(COLLECTIONS.meals);

export const mealsRepository = {
  ...base,

  listForUserByDate(userId: string, date: string) {
    return base.list([
      where("userId", "==", userId),
      where("date", "==", date),
      orderBy("createdAt", "asc"),
    ]);
  },

  listForUserRange(userId: string, take = 200) {
    return base.list([
      where("userId", "==", userId),
      orderBy("date", "desc"),
      fbLimit(take),
    ]);
  },

  /** Live subscription to the most recent `take` meals, for weekly-review-style aggregation. */
  subscribeForUser(
    userId: string,
    onData: (items: MealEntry[]) => void,
    onError?: (error: Error) => void,
    take = 200,
  ) {
    return base.subscribe(
      [where("userId", "==", userId), orderBy("date", "desc"), fbLimit(take)],
      onData,
      onError,
    );
  },

  subscribeForUserByDate(
    userId: string,
    date: string,
    onData: (items: MealEntry[]) => void,
    onError?: (error: Error) => void,
  ) {
    return base.subscribe(
      [
        where("userId", "==", userId),
        where("date", "==", date),
        orderBy("createdAt", "asc"),
      ],
      onData,
      onError,
    );
  },
};
