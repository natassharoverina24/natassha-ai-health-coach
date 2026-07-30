import type { TodayCoachPlan } from "./types";

const CACHE_KEY = "today-coach-plan:last-known";
const CACHE_VERSION = 2;
export const TODAY_COACH_PLAN_INVALIDATED_EVENT =
  "today-coach-plan:invalidated";

interface TodayCoachPlanCacheEnvelope {
  version: typeof CACHE_VERSION;
  userId: string;
  savedAt: string;
  plan: TodayCoachPlan;
}

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function planSafeForCache(plan: TodayCoachPlan): TodayCoachPlan {
  return {
    ...plan,
    briefing: {
      ...plan.briefing,
      retainedInsights: [],
      encouragement: null,
    },
  };
}

export function writeTodayCoachPlanCache(
  userId: string,
  plan: TodayCoachPlan,
  savedAt = new Date().toISOString(),
  storage = browserStorage(),
): void {
  if (!storage) return;
  const envelope: TodayCoachPlanCacheEnvelope = {
    version: CACHE_VERSION,
    userId,
    savedAt,
    plan: planSafeForCache(plan),
  };
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(envelope));
  } catch {
    // Cache failure must never block the live plan.
  }
}

export function readTodayCoachPlanCache(
  userId: string,
  expectedDate: string,
  storage = browserStorage(),
): TodayCoachPlan | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TodayCoachPlanCacheEnvelope>;
    if (
      parsed.version !== CACHE_VERSION ||
      parsed.userId !== userId ||
      typeof parsed.savedAt !== "string" ||
      !parsed.plan ||
      parsed.plan.date !== expectedDate
    ) {
      return null;
    }
    return markTodayCoachPlanStale(parsed.plan, parsed.savedAt);
  } catch {
    return null;
  }
}

export function clearTodayCoachPlanCache(
  storage = browserStorage(),
): void {
  try {
    storage?.removeItem(CACHE_KEY);
  } catch {
    // Clearing an optional cache is best-effort.
  }
}

export function invalidateTodayCoachPlanCache(
  storage = browserStorage(),
): void {
  clearTodayCoachPlanCache(storage);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TODAY_COACH_PLAN_INVALIDATED_EVENT));
  }
}

export function markTodayCoachPlanStale(
  plan: TodayCoachPlan,
  savedAt: string,
): TodayCoachPlan {
  return {
    ...plan,
    status: "partial",
    dataAvailability: {
      ...plan.dataAvailability,
      cache: { status: "stale", updatedAt: savedAt },
    },
    warnings: [
      ...plan.warnings.filter((warning) => warning.code !== "cached-plan-stale"),
      {
        code: "cached-plan-stale",
        message:
          "Showing the last saved plan while fresh data is being checked.",
        sourceIds: ["coach-plan.cache"],
      },
    ],
  };
}
