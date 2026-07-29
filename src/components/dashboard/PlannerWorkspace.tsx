"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildCoachDecision,
  buildPlannerUserContext,
} from "@/lib/ai/contextBuilder";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import {
  generateDailyPlan,
  generateMealPlan,
  type DailyPlan,
  type MealPlan,
  type PlannerUserContext,
} from "@/lib/planner";

import { DailyPlanBriefing } from "./DailyPlanBriefing";
import { PlanningToolsPanel } from "./PlanningToolsPanel";

type PlannerWorkspaceState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "success";
      decision: CoachDecision;
      context: PlannerUserContext;
      dailyPlan: DailyPlan;
      mealPlan: MealPlan;
    };

export function PlannerWorkspace() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const requestedUid = useRef<string | null>(null);

  const [state, setState] = useState<PlannerWorkspaceState>({
    status: "loading",
  });

  const load = useCallback(async (userId: string) => {
    setState({ status: "loading" });

    try {
      const [decision, context] = await Promise.all([
        buildCoachDecision(userId),
        buildPlannerUserContext(userId),
      ]);

      setState({
        status: "success",
        decision,
        context,
        dailyPlan: generateDailyPlan(decision, context),
        mealPlan: generateMealPlan(decision, context),
      });
    } catch (error) {
      console.error("PlannerWorkspace load failed:", error);
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    if (!uid || requestedUid.current === uid) {
      return;
    }

    requestedUid.current = uid;
    void load(uid);
  }, [load, uid]);

  if (!uid) {
    return (
      <GlassCard>
        <p role="status" className="text-sm text-ink-muted">
          Sign in and complete your profile to view deterministic plans.
        </p>
      </GlassCard>
    );
  }

  if (state.status === "loading") {
    return (
      <div
        role="status"
        aria-label="Loading planner"
        className="flex flex-col gap-4"
      >
        <Skeleton className="h-64 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <GlassCard>
        <section aria-labelledby="planner-unavailable-heading">
          <h2
            id="planner-unavailable-heading"
            className="text-base font-semibold text-ink"
          >
            Planner data unavailable
          </h2>

          <p role="alert" className="mt-2 text-sm text-ink-muted">
            Required profile or planning context could not be loaded. No plan
            was invented.
          </p>

          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void load(uid)}
          >
            Retry planner
          </Button>
        </section>
      </GlassCard>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <GlassCard>
        <DailyPlanBriefing
          dailyPlan={state.dailyPlan}
          mealPlan={state.mealPlan}
        />
      </GlassCard>

      <GlassCard>
        <PlanningToolsPanel
          decision={state.decision}
          context={state.context}
          dailyPlan={state.dailyPlan}
          mealPlan={state.mealPlan}
        />
      </GlassCard>
    </div>
  );
}