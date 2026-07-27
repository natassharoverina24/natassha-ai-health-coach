/**
 * motivations repository
 * Long-term "why" statements the WHY Engine rotates through (Phase 3).
 */
import { orderBy, where } from "firebase/firestore";

import { createRepository } from "./baseRepository";
import { COLLECTIONS, type MotivationEntry } from "@/types/firestore";

const base = createRepository<MotivationEntry>(COLLECTIONS.motivations);

export const motivationsRepository = {
  ...base,

  listActiveForUser(userId: string) {
    return base.list([
      where("userId", "==", userId),
      where("active", "==", true),
      orderBy("createdAt", "asc"),
    ]);
  },

  subscribeActiveForUser(
    userId: string,
    onData: (items: MotivationEntry[]) => void,
    onError?: (error: Error) => void,
  ) {
    return base.subscribe(
      [where("userId", "==", userId), where("active", "==", true), orderBy("createdAt", "asc")],
      onData,
      onError,
    );
  },

  markReferenced(id: string, referencedAt: string) {
    return base.update(id, { lastReferencedAt: referencedAt });
  },
};
