/**
 * cycles repository
 * Menstrual/hormonal cycle entries — reserved for future coaching logic
 * that adjusts calorie/protein targets across cycle phases.
 */
import { orderBy, where } from "firebase/firestore";

import { createRepository } from "./baseRepository";
import { COLLECTIONS, type CycleEntry } from "@/types/firestore";

const base = createRepository<CycleEntry>(COLLECTIONS.cycles);

export const cyclesRepository = {
  ...base,

  listForUser(userId: string) {
    return base.list([where("userId", "==", userId), orderBy("startDate", "desc")]);
  },
};
