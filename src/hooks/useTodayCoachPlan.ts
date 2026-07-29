"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import {
  buildTodayCoachPlan,
  type TodayCoachPlan,
} from "@/lib/coach-plan";

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
      if (initial) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const nextPlan = await buildTodayCoachPlan(userId);
        if (activeRequest === requestId.current) setPlan(nextPlan);
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

  const refresh = useCallback(() => load(false), [load]);

  return { plan, loading, refreshing, error, refresh };
}
