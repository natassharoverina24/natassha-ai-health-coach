"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  CalendarClock,
  Droplets,
  RefreshCw,
  Sparkles,
  Target,
  TriangleAlert,
  Trophy,
  UtensilsCrossed,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useTodayCoachPlan } from "@/hooks";
import type {
  TodayCoachPlan,
  TraceableValue,
} from "@/lib/coach-plan";
import { waterLogsRepository } from "@/lib/db/waterLogs.repository";
import type { InsightSummary } from "@/lib/planner";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";

export function TodayDashboard() {
  const { user } = useAuth();
  const { plan, loading, refreshing, error, refresh } = useTodayCoachPlan();
  const [quickWaterMl, setQuickWaterMl] = useState(0);
  const [waterSaving, setWaterSaving] = useState(false);
  const [waterError, setWaterError] = useState<string | null>(null);

  const addWater = async (amountMl: number) => {
    if (!user || !plan) return;
    setWaterSaving(true);
    setWaterError(null);
    try {
      await waterLogsRepository.create({
        userId: user.uid,
        date: plan.date,
        amountMl,
        loggedAt: new Date().toISOString(),
      });
      setQuickWaterMl((current) => current + amountMl);
      await refresh();
    } catch {
      setWaterError("Water could not be logged. Please try again.");
    } finally {
      setWaterSaving(false);
    }
  };

  if (loading && !plan) {
    return <TodayLoadingState />;
  }

  if (!plan) {
    return (
      <GlassCard>
        <section aria-labelledby="today-unavailable-heading">
          <h1 id="today-unavailable-heading" className="text-xl font-bold text-ink">
            Today
          </h1>
          <p role="alert" className="mt-2 text-sm text-ink-muted">
            {error ??
              "Sign in and complete your profile to prepare today's plan."}
          </p>
          {user && (
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => void refresh()}
            >
              Try again
            </Button>
          )}
        </section>
      </GlassCard>
    );
  }

  return (
    <main className="flex min-w-0 flex-col gap-5" aria-labelledby="today-heading">
      <TodayHero plan={plan} refreshing={refreshing} onRefresh={refresh} />

      {plan.status === "partial" && (
        <p
          role="status"
          className="rounded-control bg-amber-soft px-4 py-3 text-sm text-ink"
        >
          Today's core plan is ready. Optional tools will appear when their
          structured inputs are available.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-control bg-petal-soft px-4 py-3 text-sm text-ink">
          {error} The current plan remains visible.
        </p>
      )}

      <TodayBriefing plan={plan} />
      <TodayHighlights plan={plan} />

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <TodayTimeline plan={plan} />
        <TodayMealSummary plan={plan} />
      </div>

      <TodayMetrics plan={plan} quickWaterMl={quickWaterMl} />
      <TodayMotivation plan={plan} />
      <TodayQuickLog
        loggedWaterMl={quickWaterMl}
        saving={waterSaving}
        error={waterError}
        onAddWater={addWater}
      />
    </main>
  );
}

function TodayHero({
  plan,
  refreshing,
  onRefresh,
}: {
  plan: TodayCoachPlan;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
}) {
  return (
    <GlassCard className="overflow-hidden bg-gradient-to-br from-petal-soft to-teal-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-strong">
            {plan.date}
          </p>
          <h1 id="today-heading" className="mt-1 text-2xl font-bold text-ink">
            {plan.greeting.value}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            One traceable view of today's retained coaching plan.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Refresh today's plan"
          isLoading={refreshing}
          onClick={() => void onRefresh()}
        >
          <RefreshCw size={18} />
        </Button>
      </div>
    </GlassCard>
  );
}

function TodayBriefing({ plan }: { plan: TodayCoachPlan }) {
  return (
    <GlassCard>
      <section aria-labelledby="coach-briefing-heading">
        <h2 id="coach-briefing-heading" className="text-base font-semibold text-ink">
          Coach briefing
        </h2>
        {plan.briefing.retainedInsights.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            No retained coaching insight is available today.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {plan.briefing.retainedInsights.map((insight) => (
              <li key={insight.id} className="rounded-control bg-bg-elevated px-3 py-3">
                <p className="text-sm font-semibold text-ink">{insight.summary}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {insight.recommendedAction}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </GlassCard>
  );
}

function TodayHighlights({ plan }: { plan: TodayCoachPlan }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <HighlightCard
        title="Today's Focus"
        item={plan.focus}
        icon={<Target size={17} />}
        emptyText="No retained focus is available."
      />
      <HighlightCard
        title="Biggest Risk"
        item={plan.biggestRisk}
        icon={<TriangleAlert size={17} />}
        emptyText="No retained risk is active."
      />
      <HighlightCard
        title="Today's Win"
        item={plan.todaysWin}
        icon={<Trophy size={17} />}
        emptyText="No retained win is available yet."
      />
    </div>
  );
}

function HighlightCard({
  title,
  item,
  icon,
  emptyText,
}: {
  title: string;
  item: TraceableValue<InsightSummary> | null;
  icon: ReactNode;
  emptyText: string;
}) {
  return (
    <GlassCard padding="sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="text-rose-strong">{icon}</span>
        {title}
      </h2>
      {item ? (
        <>
          <p className="mt-2 text-sm font-medium text-ink">{item.value.summary}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {item.value.recommendedAction}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">{emptyText}</p>
      )}
    </GlassCard>
  );
}

function TodayTimeline({ plan }: { plan: TodayCoachPlan }) {
  return (
    <GlassCard>
      <section aria-labelledby="today-timeline-heading">
        <h2 id="today-timeline-heading" className="flex items-center gap-2 text-base font-semibold text-ink">
          <CalendarClock size={18} className="text-teal" />
          Timeline
        </h2>
        <ol className="mt-3 grid gap-2">
          {plan.timeline.map((item) => (
            <li
              key={item.kind}
              className="flex items-center justify-between gap-3 rounded-control bg-teal-soft px-3 py-2"
            >
              <span className="text-sm font-medium text-ink">{item.label}</span>
              <time className="text-sm font-semibold text-teal">{item.time}</time>
            </li>
          ))}
        </ol>
      </section>
    </GlassCard>
  );
}

function TodayMealSummary({ plan }: { plan: TodayCoachPlan }) {
  return (
    <GlassCard>
      <section aria-labelledby="today-meals-heading">
        <h2 id="today-meals-heading" className="flex items-center gap-2 text-base font-semibold text-ink">
          <UtensilsCrossed size={18} className="text-rose-strong" />
          Meal summary
        </h2>
        <ul className="mt-3 grid gap-2">
          {Object.values(plan.meals).map((meal) => (
            <li key={meal.slot} className="rounded-control border border-ink/8 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold capitalize text-rose-strong">
                    {meal.slot}
                  </p>
                  <p className="truncate text-sm font-semibold text-ink">
                    {meal.template.name}
                  </p>
                  <p className="text-xs text-ink-muted">{meal.template.serving}</p>
                </div>
                <p className="shrink-0 text-right text-xs text-ink-muted">
                  {meal.template.calories} kcal
                  <br />
                  {meal.template.proteinG} g protein
                </p>
              </div>
              <p className="mt-1 text-xs text-ink-muted">{meal.reason}</p>
            </li>
          ))}
        </ul>
      </section>
    </GlassCard>
  );
}

function TodayMetrics({
  plan,
  quickWaterMl,
}: {
  plan: TodayCoachPlan;
  quickWaterMl: number;
}) {
  const metrics = plan.metrics.value;
  const items = [
    ["Calories", `${metrics.calories} kcal`],
    ["Protein", `${metrics.proteinG} g`],
    ["Water", `${metrics.waterMl} ml`],
    ["Workout", `${metrics.workoutMin} min`],
    ["Steps", metrics.steps.toLocaleString("id-ID")],
    ["Sleep", `${metrics.sleepHours} h`],
  ];
  return (
    <GlassCard>
      <section aria-labelledby="today-metrics-heading">
        <h2 id="today-metrics-heading" className="text-base font-semibold text-ink">
          Today's metrics
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map(([label, value]) => (
            <div key={label} className="rounded-control bg-bg-elevated px-3 py-2">
              <dt className="text-xs text-ink-muted">{label}</dt>
              <dd className="text-sm font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <p role="status" className="mt-3 text-xs text-ink-muted">
          Water added with quick log this session: {quickWaterMl} ml.
        </p>
      </section>
    </GlassCard>
  );
}

function TodayMotivation({ plan }: { plan: TodayCoachPlan }) {
  return (
    <GlassCard padding="sm">
      <section aria-labelledby="today-motivation-heading">
        <h2 id="today-motivation-heading" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Sparkles size={16} className="text-amber" />
          Motivation
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          {plan.briefing.encouragement?.value ??
            "No retained motivation is available today."}
        </p>
      </section>
    </GlassCard>
  );
}

function TodayQuickLog({
  loggedWaterMl,
  saving,
  error,
  onAddWater,
}: {
  loggedWaterMl: number;
  saving: boolean;
  error: string | null;
  onAddWater: (amountMl: number) => Promise<void>;
}) {
  return (
    <GlassCard>
      <section aria-labelledby="quick-log-heading">
        <h2 id="quick-log-heading" className="text-base font-semibold text-ink">
          Quick log
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Add water without leaving Today.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[250, 500].map((amount) => (
            <Button
              key={amount}
              type="button"
              variant="secondary"
              leadingIcon={<Droplets size={16} />}
              disabled={saving}
              onClick={() => void onAddWater(amount)}
            >
              Add {amount} ml water
            </Button>
          ))}
        </div>
        <p role="status" className="mt-3 text-xs text-ink-muted">
          Logged from quick actions: {loggedWaterMl} ml.
        </p>
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </section>
    </GlassCard>
  );
}

function TodayLoadingState() {
  return (
    <div role="status" aria-label="Loading Today" className="flex flex-col gap-5">
      <Skeleton className="h-40 w-full rounded-card" />
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-36 w-full rounded-card" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-card" />
    </div>
  );
}
