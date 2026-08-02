"use client";

import { useCallback, useEffect, useState } from "react";

import { AutoShoppingList } from "@/components/shopping";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildCoachDecision,
  buildPlannerUserContext,
} from "@/lib/ai/contextBuilder";
import { generateWeeklyMealPrep } from "@/lib/planner";
import {
  buildShoppingListFromMealPlan,
  readMealReplacementSelections,
  type ShoppingListResult,
} from "@/lib/shopping-list";

type ShoppingPageState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; result: ShoppingListResult };

export default function ShoppingPage() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const [state, setState] = useState<ShoppingPageState>({ status: "loading" });

  const load = useCallback(async () => {
    if (!userId) {
      setState({
        status: "ready",
        result: { status: "empty", items: [], warnings: [] },
      });
      return;
    }

    setState({ status: "loading" });
    try {
      const [decision, context] = await Promise.all([
        buildCoachDecision(userId),
        buildPlannerUserContext(userId),
      ]);
      const weekly = generateWeeklyMealPrep({
        decision,
        context,
        officeLunchByDate: {},
        ingredientCatalogue: {},
      });
      const days = weekly.status === "success" ? weekly.days : weekly.days ?? [];
      setState({
        status: "ready",
        result: buildShoppingListFromMealPlan({
          days,
          selectedReplacements: readMealReplacementSelections(userId),
        }),
      });
    } catch {
      setState({ status: "error" });
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Daftar Belanja"
        description="Daftar belanja otomatis dari meal plan mingguanmu."
      />

      {state.status === "loading" ? (
        <div role="status" aria-label="Memuat shopping list" className="grid gap-4">
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-44 w-full rounded-card" />
        </div>
      ) : state.status === "error" ? (
        <GlassCard>
          <p role="alert" className="text-sm text-ink-muted">
            Shopping list belum bisa dimuat sekarang. Coba lagi sebentar ya 💗
          </p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void load()}>
            Coba lagi
          </Button>
        </GlassCard>
      ) : (
        <AutoShoppingList result={state.result} />
      )}
    </div>
  );
}
