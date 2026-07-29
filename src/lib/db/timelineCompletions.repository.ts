import { where } from "firebase/firestore";

import { createRepository } from "./baseRepository";
import {
  COLLECTIONS,
  type TimelineCompletionEntry,
} from "@/types/firestore";

const base = createRepository<TimelineCompletionEntry>(
  COLLECTIONS.timelineCompletions,
);

export function timelineCompletionDocumentId(
  userId: string,
  date: string,
  itemId: string,
): string {
  return [userId, date, itemId].map(encodeURIComponent).join("__");
}

export const timelineCompletionsRepository = {
  ...base,

  listForUserByDate(userId: string, date: string) {
    return base.list([
      where("userId", "==", userId),
      where("date", "==", date),
    ]);
  },

  async markCompleted(
    data: Omit<TimelineCompletionEntry, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> {
    const id = timelineCompletionDocumentId(
      data.userId,
      data.date,
      data.itemId,
    );
    const existing = await base.get(id);
    if (existing) return id;
    return base.create(data, id);
  },
};
