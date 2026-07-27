/**
 * supplements + supplement_logs repositories
 * `supplements` holds the definitions (name, dosage, schedule);
 * `supplement_logs` holds daily taken/not-taken checkmarks against them.
 */
import { orderBy, where } from "firebase/firestore";

import { createRepository } from "./baseRepository";
import {
  COLLECTIONS,
  type SupplementDefinition,
  type SupplementLog,
} from "@/types/firestore";

const definitions = createRepository<SupplementDefinition>(COLLECTIONS.supplements);
const logs = createRepository<SupplementLog>(COLLECTIONS.supplementLogs);

export const supplementsRepository = {
  ...definitions,

  listActiveForUser(userId: string) {
    return definitions.list([
      where("userId", "==", userId),
      where("active", "==", true),
    ]);
  },

  subscribeActiveForUser(
    userId: string,
    onData: (items: SupplementDefinition[]) => void,
    onError?: (error: Error) => void,
  ) {
    return definitions.subscribe(
      [where("userId", "==", userId), where("active", "==", true)],
      onData,
      onError,
    );
  },
};

export const supplementLogsRepository = {
  ...logs,

  listForUserByDate(userId: string, date: string) {
    return logs.list([
      where("userId", "==", userId),
      where("date", "==", date),
    ]);
  },

  subscribeForUserByDate(
    userId: string,
    date: string,
    onData: (items: SupplementLog[]) => void,
    onError?: (error: Error) => void,
  ) {
    return logs.subscribe(
      [where("userId", "==", userId), where("date", "==", date)],
      onData,
      onError,
    );
  },

  listForUserRange(userId: string, take = 30) {
    return logs.list([where("userId", "==", userId), orderBy("date", "desc")]).then(
      (items) => items.slice(0, take),
    );
  },
};
