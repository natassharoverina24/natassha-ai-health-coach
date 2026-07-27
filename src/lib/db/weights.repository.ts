/**
 * weights repository
 * Time-series of body-weight entries, one per user per day (typically).
 */
import { limit as fbLimit, orderBy, where } from "firebase/firestore";

import { createRepository } from "./baseRepository";
import { COLLECTIONS, type WeightEntry } from "@/types/firestore";

const base = createRepository<WeightEntry>(COLLECTIONS.weights);

export const weightsRepository = {
  ...base,

  listForUser(userId: string, take = 90) {
    return base.list([
      where("userId", "==", userId),
      orderBy("date", "desc"),
      fbLimit(take),
    ]);
  },

  subscribeForUser(
    userId: string,
    onData: (items: WeightEntry[]) => void,
    onError?: (error: Error) => void,
    take = 90,
  ) {
    return base.subscribe(
      [where("userId", "==", userId), orderBy("date", "desc"), fbLimit(take)],
      onData,
      onError,
    );
  },

  async getLatest(userId: string): Promise<WeightEntry | null> {
    const results = await base.list([
      where("userId", "==", userId),
      orderBy("date", "desc"),
      fbLimit(1),
    ]);
    return results[0] ?? null;
  },
};
