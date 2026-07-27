/**
 * shopping repository
 * The running grocery list. Items can be added manually, carried over as
 * recurring staples, or (later) suggested by the AI coach.
 */
import { orderBy, where } from "firebase/firestore";

import { createRepository } from "./baseRepository";
import { COLLECTIONS, type ShoppingItem } from "@/types/firestore";

const base = createRepository<ShoppingItem>(COLLECTIONS.shopping);

export const shoppingRepository = {
  ...base,

  listForUser(userId: string) {
    return base.list([where("userId", "==", userId), orderBy("createdAt", "desc")]);
  },

  subscribeForUser(
    userId: string,
    onData: (items: ShoppingItem[]) => void,
    onError?: (error: Error) => void,
  ) {
    return base.subscribe(
      [where("userId", "==", userId), orderBy("createdAt", "desc")],
      onData,
      onError,
    );
  },

  toggleChecked(id: string, checked: boolean) {
    return base.update(id, { checked });
  },
};
