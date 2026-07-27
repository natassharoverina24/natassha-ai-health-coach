/**
 * workouts repository
 * Minimal workout logging (Phase 2C: Weekly Progress & Coach Dashboard) —
 * just enough to know a workout happened on a given day, for adherence
 * tracking and milestones. Same shape/pattern as water_logs.
 */
import { limit as fbLimit, orderBy, where } from "firebase/firestore";

import { createRepository } from "./baseRepository";
import { COLLECTIONS, type WorkoutEntry } from "@/types/firestore";

const base = createRepository<WorkoutEntry>(COLLECTIONS.workouts);

export const workoutsRepository = {
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
    onData: (items: WorkoutEntry[]) => void,
    onError?: (error: Error) => void,
    take = 90,
  ) {
    return base.subscribe(
      [where("userId", "==", userId), orderBy("date", "desc"), fbLimit(take)],
      onData,
      onError,
    );
  },

  /** Every workout logged for a specific calendar date. */
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
