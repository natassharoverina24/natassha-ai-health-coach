import { createRepository } from "./baseRepository";
import {
  COLLECTIONS,
  type ActiveDisruption,
  type EmergencyAffectedSlot,
  type EmergencyDisruptionType,
  type MealType,
} from "@/types/firestore";

interface ActiveDisruptionInputBase {
  userId: string;
  date: string;
  startedAt: string;
  note?: string | null;
}

export type ActiveDisruptionSelection =
  | {
      type: "working-late";
      expectedEndAt: string;
    }
  | {
      type: "travelling";
      affectedSlot: EmergencyAffectedSlot;
    }
  | {
      type: "event-or-reception";
      affectedMealSlot: "lunch" | "dinner" | "snack";
    }
  | {
      type: "skipped-meal";
      skippedMealSlot: MealType;
      skippedAt: string;
    }
  | {
      type:
        | "migraine"
        | "feeling-unwell"
        | "pms"
        | "missed-workout";
    };

export type ActiveDisruptionInput =
  ActiveDisruptionInputBase & ActiveDisruptionSelection;

const base = createRepository<ActiveDisruption>(
  COLLECTIONS.activeDisruptions,
);
const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES: readonly EmergencyDisruptionType[] = [
  "working-late",
  "migraine",
  "feeling-unwell",
  "pms",
  "travelling",
  "event-or-reception",
  "missed-workout",
  "skipped-meal",
];
const AFFECTED_SLOTS: readonly EmergencyAffectedSlot[] = [
  "breakfast",
  "lunch",
  "snack",
  "dinner",
  "workout",
];
const MEAL_SLOTS: readonly MealType[] = [
  "breakfast",
  "lunch",
  "snack",
  "dinner",
];

function logDevelopmentFailure(
  operation: "read" | "save" | "clear",
  error: unknown,
) {
  if (process.env.NODE_ENV === "production") return;
  const rawCode =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "unknown";
  const code = /^[a-z0-9-]+(?:\/[a-z0-9-]+)?$/i.test(rawCode)
    ? rawCode
    : "unknown";
  console.error("[active-disruptions] operation failed", {
    operation,
    code,
  });
}

function safeErrorCode(error: unknown): string {
  const rawCode =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "unknown";
  return /^[a-z0-9-]+(?:\/[a-z0-9-]+)?$/i.test(rawCode)
    ? rawCode
    : "unknown";
}

function safeErrorMessage(code: string): string {
  if (code.endsWith("permission-denied")) {
    return "Firestore permission denied the emergency adjustment.";
  }
  if (code.endsWith("unauthenticated")) {
    return "Authentication was not available for the emergency adjustment.";
  }
  if (code.endsWith("unavailable")) {
    return "Firestore was temporarily unavailable.";
  }
  return "Emergency adjustment save failed.";
}

function logSaveFailure(
  error: unknown,
  documentId: string,
  payload: Record<string, unknown>,
) {
  const code = safeErrorCode(error);
  console.error("[EmergencyMode] save failed", {
    code,
    message: safeErrorMessage(code),
    collection: COLLECTIONS.activeDisruptions,
    path: `${COLLECTIONS.activeDisruptions}/${documentId}`,
    docId: documentId,
    payloadKeys: Object.keys(payload).sort(),
  });
}

export function activeDisruptionDocumentId(userId: string, date: string) {
  return [userId, date].map(encodeURIComponent).join("__");
}

export function validateActiveDisruptionInput(
  value: unknown,
): value is ActiveDisruptionInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  if (
    typeof input.userId !== "string" ||
    input.userId.trim().length === 0 ||
    typeof input.date !== "string" ||
    !ISO_DATE.test(input.date) ||
    typeof input.startedAt !== "string" ||
    Number.isNaN(new Date(input.startedAt).getTime()) ||
    !TYPES.includes(input.type as EmergencyDisruptionType) ||
    (input.note != null &&
      (typeof input.note !== "string" || input.note.length > 240))
  ) {
    return false;
  }
  if (input.type === "working-late") {
    return typeof input.expectedEndAt === "string" &&
      CLOCK.test(input.expectedEndAt);
  }
  if (input.type === "travelling") {
    return AFFECTED_SLOTS.includes(
      input.affectedSlot as EmergencyAffectedSlot,
    );
  }
  if (input.type === "event-or-reception") {
    return ["lunch", "dinner", "snack"].includes(
      String(input.affectedMealSlot),
    );
  }
  if (input.type === "skipped-meal") {
    return (
      MEAL_SLOTS.includes(input.skippedMealSlot as MealType) &&
      typeof input.skippedAt === "string" &&
      CLOCK.test(input.skippedAt)
    );
  }
  return true;
}

function documentFromInput(input: ActiveDisruptionInput): Omit<
  ActiveDisruption,
  "id" | "createdAt" | "updatedAt"
> {
  return {
    userId: input.userId,
    date: input.date,
    type: input.type,
    startedAt: input.startedAt,
    note: input.note?.trim() || null,
    status: "active",
    clearedAt: null,
    expectedEndAt:
      input.type === "working-late" ? input.expectedEndAt : null,
    affectedSlot:
      input.type === "travelling" ? input.affectedSlot : null,
    affectedMealSlot:
      input.type === "event-or-reception"
        ? input.affectedMealSlot
        : null,
    skippedMealSlot:
      input.type === "skipped-meal" ? input.skippedMealSlot : null,
    skippedAt: input.type === "skipped-meal" ? input.skippedAt : null,
  };
}

export const activeDisruptionsRepository = {
  ...base,

  async getActiveForUserByDate(
    userId: string,
    date: string,
  ): Promise<ActiveDisruption | null> {
    try {
      const disruption = await base.get(
        activeDisruptionDocumentId(userId, date),
      );
      return disruption?.userId === userId &&
        disruption.date === date &&
        disruption.status === "active"
        ? disruption
        : null;
    } catch (error) {
      logDevelopmentFailure("read", error);
      throw error;
    }
  },

  async setActive(input: ActiveDisruptionInput): Promise<string> {
    if (!validateActiveDisruptionInput(input)) {
      throw new Error("invalid-active-disruption");
    }
    const id = activeDisruptionDocumentId(input.userId, input.date);
    const payload = documentFromInput(input);
    try {
      return await base.create(payload, id);
    } catch (error) {
      logSaveFailure(error, id, payload);
      throw error;
    }
  },

  async clear(userId: string, date: string, clearedAt: string): Promise<void> {
    const id = activeDisruptionDocumentId(userId, date);
    try {
      const existing = await base.get(id);
      if (
        !existing ||
        existing.userId !== userId ||
        existing.date !== date ||
        existing.status === "cleared"
      ) {
        return;
      }
      await base.update(id, { status: "cleared", clearedAt });
    } catch (error) {
      logDevelopmentFailure("clear", error);
      throw error;
    }
  },
};
