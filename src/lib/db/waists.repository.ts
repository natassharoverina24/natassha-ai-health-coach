/**
 * waists repository
 * Time-series of body-measurement entries (waist / hip / chest).
 */
import { limit as fbLimit, orderBy, where } from "firebase/firestore";

import { createRepository } from "./baseRepository";
import { COLLECTIONS, type WaistEntry } from "@/types/firestore";

const base = createRepository<WaistEntry>(COLLECTIONS.waists);

export const waistsRepository = {
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
    onData: (items: WaistEntry[]) => void,
    onError?: (error: Error) => void,
    take = 90,
  ) {
    return base.subscribe(
      [where("userId", "==", userId), orderBy("date", "desc"), fbLimit(take)],
      onData,
      onError,
    );
  },
};
