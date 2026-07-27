/**
 * reports repository
 * Generated weekly/monthly summaries. Generation logic lives in the
 * (not-yet-implemented) business logic layer; this just persists results.
 */
import { limit as fbLimit, orderBy, where } from "firebase/firestore";

import { createRepository } from "./baseRepository";
import { COLLECTIONS, type ReportSummary } from "@/types/firestore";

const base = createRepository<ReportSummary>(COLLECTIONS.reports);

export const reportsRepository = {
  ...base,

  listForUser(userId: string, take = 24) {
    return base.list([
      where("userId", "==", userId),
      orderBy("endDate", "desc"),
      fbLimit(take),
    ]);
  },

  subscribeForUser(
    userId: string,
    onData: (items: ReportSummary[]) => void,
    onError?: (error: Error) => void,
    take = 24,
  ) {
    return base.subscribe(
      [where("userId", "==", userId), orderBy("endDate", "desc"), fbLimit(take)],
      onData,
      onError,
    );
  },
};
