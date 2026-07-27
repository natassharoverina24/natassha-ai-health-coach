/**
 * settings repository
 * One settings document per user (document id === uid), covering theme,
 * notification prefs, and daily goals used across the dashboard.
 */
import { createRepository } from "./baseRepository";
import { COLLECTIONS, type UserSettings } from "@/types/firestore";

const base = createRepository<UserSettings>(COLLECTIONS.settings);

export const settingsRepository = {
  ...base,

  getForUser(userId: string) {
    return base.get(userId);
  },

  subscribeForUser(
    userId: string,
    onData: (settings: UserSettings | null) => void,
    onError?: (error: Error) => void,
  ) {
    return base.subscribeOne(userId, onData, onError);
  },

  upsert(userId: string, data: Omit<UserSettings, "id" | "createdAt" | "updatedAt" | "userId">) {
    return base.create({ ...data, userId } as Omit<UserSettings, "id" | "createdAt" | "updatedAt">, userId);
  },

  updateForUser(userId: string, data: Partial<UserSettings>) {
    return base.update(userId, data);
  },
};
