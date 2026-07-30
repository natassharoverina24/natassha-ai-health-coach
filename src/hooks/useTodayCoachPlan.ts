"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import {
  buildTodayCoachPlan,
  readTodayCoachPlanCache,
  TODAY_COACH_PLAN_INVALIDATED_EVENT,
  type TodayCoachPlan,
  writeTodayCoachPlanCache,
} from "@/lib/coach-plan";
import { todayISODate } from "@/lib/utils/format";

export interface UseTodayCoachPlanResult {
  plan: TodayCoachPlan | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const FRIENDLY_ERROR =
  "Today's plan is temporarily unavailable. Please try again.";

export function useTodayCoachPlan(): UseTodayCoachPlanResult {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const requestId = useRef(0);
  const [plan, setPlan] = useState<TodayCoachPlan | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (initial: boolean) => {
      if (!userId) {
        setPlan(null);
        setLoading(false);
        setRefreshing(false);
        setError(null);
        return;
      }

      const activeRequest = ++requestId.current;
      if (initial) {
        const cachedPlan = readTodayCoachPlanCache(userId, todayISODate());
        if (cachedPlan) setPlan(cachedPlan);
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        const nextPlan = await buildTodayCoachPlan(userId);
        if (activeRequest === requestId.current) {
          setPlan(nextPlan);
          writeTodayCoachPlanCache(userId, nextPlan);
        }
      } catch {
        if (activeRequest === requestId.current) setError(FRIENDLY_ERROR);
      } finally {
        if (activeRequest === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [userId],
  );

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load(true);
    });
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    const refreshAfterDataChange = () => void load(false);
    window.addEventListener(
      TODAY_COACH_PLAN_INVALIDATED_EVENT,
      refreshAfterDataChange,
    );
    return () =>
      window.removeEventListener(
        TODAY_COACH_PLAN_INVALIDATED_EVENT,
        refreshAfterDataChange,
      );
  }, [load]);

  const refresh = useCallback(() => load(false), [load]);

  return { plan, loading, refreshing, error, refresh };
}
