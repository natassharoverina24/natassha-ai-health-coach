/**
 * ai_logs repository
 * Append-only conversation/event log for the AI coach. The AI layer itself
 * (src/lib/ai) is not implemented yet, but the persistence contract is
 * ready so future work only has to produce entries, not design storage.
 */
import { limit as fbLimit, orderBy, where } from "firebase/firestore";

import { createRepository } from "./baseRepository";
import { COLLECTIONS, type AILogEntry } from "@/types/firestore";

const base = createRepository<AILogEntry>(COLLECTIONS.aiLogs);

export const aiLogsRepository = {
  ...base,

  listForUser(userId: string, take = 50) {
    return base.list([
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      fbLimit(take),
    ]);
  },
};
