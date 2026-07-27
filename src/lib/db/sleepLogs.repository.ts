/**
 * sleep_logs repository
 * Minimal nightly sleep logging (Phase 2C: Weekly Progress & Coach
 * Dashboard) — one entry per day, hours slept, for adherence tracking.
 * Same shape/pattern as water_logs / workouts.
 */
import { limit as fbLimit, orderBy, where } from "firebase/firestore";

import { createRepository } from "./baseRepository";
import { COLLECTIONS, type SleepEntry } from "@/types/firestore";

const base = createRepository<SleepEntry>(COLLECTIONS.sleepLogs);

export const sleepLogsRepository = {
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
    onData: (items: SleepEntry[]) => void,
    onError?: (error: Error) => void,
    take = 90,
  ) {
    return base.subscribe(
      [where("userId", "==", userId), orderBy("date", "desc"), fbLimit(take)],
      onData,
      onError,
    );
  },

  listForUserByDate(userId: string, date: string) {
    return base.list([where("userId", "==", userId), where("date", "==", date)]);
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
};
