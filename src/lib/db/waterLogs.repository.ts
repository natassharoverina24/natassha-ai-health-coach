/**
 * water_logs repository
 * Daily water-intake entries logged from the Meal page's Water Tracker
 * (Phase 2A). Same shape and query pattern as supplement_logs — small,
 * timestamped, per-day entries under their own collection.
 */
import { limit as fbLimit, orderBy, where } from "firebase/firestore";

import { createRepository } from "./baseRepository";
import { COLLECTIONS, type WaterLogEntry } from "@/types/firestore";

const base = createRepository<WaterLogEntry>(COLLECTIONS.waterLogs);

export const waterLogsRepository = {
  ...base,

  listForUserByDate(userId: string, date: string) {
    return base.list([
      where("userId", "==", userId),
      where("date", "==", date),
      orderBy("loggedAt", "asc"),
    ]);
  },

  subscribeForUserByDate(
    userId: string,
    date: string,
    onData: (items: WaterLogEntry[]) => void,
    onError?: (error: Error) => void,
  ) {
    return base.subscribe(
      [where("userId", "==", userId), where("date", "==", date), orderBy("loggedAt", "asc")],
      onData,
      onError,
    );
  },

  /** Inclusive date-range query, e.g. the last 7/14 days for weekly review. */
  listForUserDateRange(userId: string, startDate: string, endDate: string) {
    return base.list([
      where("userId", "==", userId),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "asc"),
    ]);
  },

  /** Plain (non-live) fetch of the most recent `take` entries. */
  listForUser(userId: string, take = 400) {
    return base.list([where("userId", "==", userId), orderBy("date", "desc"), fbLimit(take)]);
  },

  /** Live subscription to the most recent `take` entries, for weekly-review-style aggregation. */
  subscribeForUser(
    userId: string,
    onData: (items: WaterLogEntry[]) => void,
    onError?: (error: Error) => void,
    take = 400,
  ) {
    return base.subscribe(
      [where("userId", "==", userId), orderBy("date", "desc"), fbLimit(take)],
      onData,
      onError,
    );
  },
};
