"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
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
  GoalMetricValue,
  MealAlternative,
  MetricValue,
  TodayCoachPlan,
  TraceableValue,
} from "@/lib/coach-plan";
import type {
  PracticalFoodRole,
  PracticalSubstitutionGroup,
} from "@/lib/meal-substitutions";
import {
  clearMealReplacementSelection,
  readMealReplacementSelections,
  saveMealReplacementSelection,
} from "@/lib/shopping-list";
import { waterLogsRepository } from "@/lib/db/waterLogs.repository";
import { timelineCompletionsRepository } from "@/lib/db/timelineCompletions.repository";
import {
  activeDisruptionsRepository,
  type ActiveDisruptionSelection,
} from "@/lib/db/activeDisruptions.repository";
import type {
  InsightSummary,
  OfficeLunchRecommendation,
} from "@/lib/planner";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlansChangedCard } from "./PlansChangedCard";
import { ThingsINoticedCard } from "./ThingsINoticedCard";
import { TodayQuickActionHub } from "./TodayQuickActionHub";

export function TodayDashboard() {
  const { user } = useAuth();
  const { plan, loading, refreshing, error, refresh } = useTodayCoachPlan();
  const [quickWaterMl, setQuickWaterMl] = useState(0);
  const [waterSaving, setWaterSaving] = useState(false);
  const [waterError, setWaterError] = useState<string | null>(null);
  const [timelineSavingId, setTimelineSavingId] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [disruptionSaving, setDisruptionSaving] = useState(false);
  const [disruptionError, setDisruptionError] = useState<string | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);

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
      setWaterError("Airnya belum berhasil dicatat. Coba lagi ya.");
    } finally {
      setWaterSaving(false);
    }
  };

  const completeTimelineItem = async (
    item: TodayCoachPlan["timeline"][number],
  ) => {
    if (!user || !item.manualCompletionAllowed || timelineSavingId) return;
    setTimelineSavingId(item.id);
    setTimelineError(null);
    try {
      await timelineCompletionsRepository.markCompleted({
        userId: user.uid,
        date: item.date,
        itemId: item.id,
        completedAt: new Date().toISOString(),
      });
      await refresh();
    } catch {
      setTimelineError(
        "Status jadwalnya belum berhasil disimpan. Coba lagi ya.",
      );
    } finally {
      setTimelineSavingId(null);
    }
  };

  const saveDisruption = async (selection: ActiveDisruptionSelection) => {
    if (!user || !plan) return;
    setDisruptionSaving(true);
    setDisruptionError(null);
    try {
      await activeDisruptionsRepository.setActive({
        userId: user.uid,
        date: plan.date,
        startedAt: new Date().toISOString(),
        ...selection,
      });
      await refresh();
    } catch {
      setDisruptionError(
        "Penyesuaian hari ini belum berhasil disimpan. Coba lagi ya.",
      );
    } finally {
      setDisruptionSaving(false);
    }
  };

  const clearDisruption = async () => {
    if (!user || !plan) return;
    setDisruptionSaving(true);
    setDisruptionError(null);
    try {
      await activeDisruptionsRepository.clear(
        user.uid,
        plan.date,
        new Date().toISOString(),
      );
      await refresh();
    } catch {
      setDisruptionError(
        "Penyesuaiannya belum berhasil dibatalkan. Coba lagi ya.",
      );
    } finally {
      setDisruptionSaving(false);
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
            Hari ini
          </h1>
          <p role="alert" className="mt-2 text-sm text-ink-muted">
            {error
              ? "Plan hari ini belum bisa dimuat. Coba lagi sebentar ya."
              : "Masuk dan lengkapi profil dulu supaya plan hari ini bisa disiapkan."}
          </p>
          {user && (
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => void refresh()}
            >
              Coba lagi
            </Button>
          )}
        </section>
      </GlassCard>
    );
  }

  return (
    <main className="flex min-w-0 flex-col gap-5" aria-labelledby="today-heading">
      <TodayHero plan={plan} refreshing={refreshing} onRefresh={refresh} />
      <TodayQuickActionHub />

      {plan.status === "partial" && (
        <p
          role="status"
          className="rounded-control bg-amber-soft px-4 py-3 text-sm text-ink"
        >
          Plan intinya sudah siap 💗 Bagian lain akan muncul saat datanya tersedia.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-control bg-petal-soft px-4 py-3 text-sm text-ink">
          Ada data tambahan yang belum bisa dimuat. Plan yang tersedia tetap bisa kamu lihat.
        </p>
      )}

      <TodayBriefing
        plan={plan}
        open={briefingOpen}
        onToggle={() => setBriefingOpen((current) => !current)}
      />
      <TodayHighlights plan={plan} />
      <PlansChangedCard
        adjustment={plan.emergencyAdjustment?.value ?? null}
        saving={disruptionSaving}
        error={disruptionError}
        onSave={saveDisruption}
        onClear={clearDisruption}
      />

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <TodayTimeline
          plan={plan}
          savingId={timelineSavingId}
          error={timelineError}
          onComplete={completeTimelineItem}
        />
        <TodayMealSummary
          key={`${user?.uid ?? "anonymous"}:${plan.date}`}
          plan={plan}
          userId={user?.uid ?? null}
        />
      </div>

      <TodayMetrics plan={plan} quickWaterMl={quickWaterMl} />
      <ThingsINoticedCard insights={plan.adaptiveInsights ?? []} />
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
    <GlassCard className="overflow-hidden bg-gradient-to-br from-petal-soft to-amber-soft/60">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-strong">
            {plan.date}
          </p>
          <h1 id="today-heading" className="mt-1 text-2xl font-bold text-ink">
            {plan.greeting.value}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Plan hari ini sudah siap 💗
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Refresh plan hari ini"
          isLoading={refreshing}
          onClick={() => void onRefresh()}
        >
          <RefreshCw size={18} />
        </Button>
      </div>
    </GlassCard>
  );
}

function TodayBriefing({
  plan,
  open,
  onToggle,
}: {
  plan: TodayCoachPlan;
  open: boolean;
  onToggle: () => void;
}) {
  const insights = plan.briefing.retainedInsights.slice(0, 3);
  return (
    <GlassCard>
      <section aria-labelledby="coach-briefing-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="coach-briefing-heading" className="text-base font-semibold text-ink">
            Ringkasan coach
          </h2>
          <button
            type="button"
            className="min-h-11 rounded-control px-3 text-sm font-semibold text-rose-strong"
            aria-expanded={open}
            aria-controls="coach-briefing-content"
            onClick={onToggle}
          >
            {open ? "Tutup" : "Lihat ringkasan"}
          </button>
        </div>
        {insights.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            Belum ada catatan coach tambahan hari ini.
          </p>
        ) : open ? (
          <ul id="coach-briefing-content" className="mt-3 grid gap-2">
            {insights.map((insight) => (
              <li key={insight.id} className="rounded-control bg-bg-elevated px-3 py-3">
                <p className="text-sm font-semibold text-ink">
                  {friendlyCoachText(insight.summary)}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {friendlyCoachText(insight.recommendedAction)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            Ada {insights.length} catatan singkat untuk menemani harimu.
          </p>
        )}
      </section>
    </GlassCard>
  );
}

function TodayHighlights({ plan }: { plan: TodayCoachPlan }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <HighlightCard
        title="Fokus hari ini"
        item={plan.focus}
        icon={<Target size={17} />}
        emptyText="Belum ada fokus tambahan hari ini."
      />
      <HighlightCard
        title="Yang perlu dijaga"
        item={plan.biggestRisk}
        icon={<TriangleAlert size={17} />}
        emptyText="Belum ada hal khusus yang perlu dijaga."
      />
      <HighlightCard
        title="Kemenangan hari ini"
        item={plan.todaysWin}
        icon={<Trophy size={17} />}
        emptyText="Langkah kecilmu akan muncul di sini."
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
          <p className="mt-2 text-sm font-medium text-ink">
            {friendlyCoachText(item.value.summary)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {friendlyCoachText(item.value.recommendedAction)}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">{emptyText}</p>
      )}
    </GlassCard>
  );
}

function TodayTimeline({
  plan,
  savingId,
  error,
  onComplete,
}: {
  plan: TodayCoachPlan;
  savingId: string | null;
  error: string | null;
  onComplete: (
    item: TodayCoachPlan["timeline"][number],
  ) => Promise<void>;
}) {
  return (
    <GlassCard>
      <section aria-labelledby="today-timeline-heading">
        <h2 id="today-timeline-heading" className="flex items-center gap-2 text-base font-semibold text-ink">
          <CalendarClock size={18} className="text-rose-strong" />
          Jadwal hari ini
        </h2>
        <ol className="mt-3 grid gap-3">
          {plan.timeline.map((item) => (
            <li
              key={item.id}
              className="rounded-control border border-rose-strong/10 bg-petal-soft/45 px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  {item.status === "completed" ? (
                    <CheckCircle2
                      size={18}
                      className="mt-0.5 shrink-0 text-rose-strong"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      size={18}
                      className="mt-0.5 shrink-0 text-ink-muted"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {item.action}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {item.reason}
                    </p>
                  </div>
                </div>
                <time className="shrink-0 text-sm font-semibold text-rose-strong">
                  {item.time}
                </time>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className="rounded-full bg-bg-elevated px-2 py-1 font-semibold capitalize text-ink"
                  aria-label={`Status: ${item.status}`}
                >
                  {timelineStatusLabel(item.status)}
                </span>
                <span className="text-ink-muted">{item.statusMessage}</span>
              </div>
              {item.impact.length > 0 && (
                <p className="mt-2 text-xs text-ink-muted">
                  Dampak harian:{" "}
                  {item.impact
                    .map((impact) =>
                      impact.plannedValue === null
                        ? `${impact.dailyTarget} ${impact.unit} daily target`
                        : `${impact.plannedValue} ${impact.unit} planned`,
                    )
                    .join(" · ")}
                </p>
              )}
              {item.alternative && (
                <p className="mt-1 text-xs text-ink-muted">
                  Alternatif: {item.alternative}
                </p>
              )}
              {item.manualCompletionAllowed &&
                item.status !== "completed" && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    disabled={savingId !== null}
                    isLoading={savingId === item.id}
                    onClick={() => void onComplete(item)}
                  >
                    Tandai selesai
                  </Button>
                )}
            </li>
          ))}
        </ol>
        {error && (
          <p role="alert" className="mt-3 text-xs text-danger">
            {error}
          </p>
        )}
      </section>
    </GlassCard>
  );
}

function TodayMealSummary({
  plan,
  userId,
}: {
  plan: TodayCoachPlan;
  userId: string | null;
}) {
  const [openSlots, setOpenSlots] = useState<Record<string, boolean>>({});
  const [selectedBySlot, setSelectedBySlot] = useState<Record<string, string>>(
    () =>
      userId
        ? Object.fromEntries(
            readMealReplacementSelections(userId)
              .filter((selection) => selection.date === plan.date)
              .map((selection) => [selection.slot, selection.templateId]),
          )
        : {},
  );
  const roleLabels: Record<PracticalFoodRole, string> = {
    protein: "Protein",
    carb: "Karbohidrat",
    "vegetable-fiber": "Sayur / fiber",
    "fruit-snack": "Buah / snack",
    drink: "Minuman",
  };

  const selectAlternative = (
    meal: TodayCoachPlan["meals"][keyof TodayCoachPlan["meals"]],
    alternative: MealAlternative,
  ) => {
    setSelectedBySlot((current) => ({
      ...current,
      [meal.slot]: alternative.templateId,
    }));
    if (userId) {
      saveMealReplacementSelection({
        userId,
        date: plan.date,
        slot: meal.slot,
        templateId: alternative.templateId,
        label: alternative.name,
        selectedAt: new Date().toISOString(),
      });
    }
  };

  const resetAlternative = (
    meal: TodayCoachPlan["meals"][keyof TodayCoachPlan["meals"]],
  ) => {
    setSelectedBySlot((current) => {
      const next = { ...current };
      delete next[meal.slot];
      return next;
    });
    if (userId) clearMealReplacementSelection(userId, plan.date, meal.slot);
  };

  return (
    <GlassCard>
      <section aria-labelledby="today-meals-heading">
        <h2 id="today-meals-heading" className="flex items-center gap-2 text-base font-semibold text-ink">
          <UtensilsCrossed size={18} className="text-rose-strong" />
          Panduan makan
        </h2>
        <ul className="mt-3 grid gap-3">
          {Object.values(plan.meals).map((meal) => {
            const selectedAlternative = meal.alternatives.find(
              (alternative: MealAlternative) =>
                alternative.templateId === selectedBySlot[meal.slot],
            );
            const displayedRecommendation = selectedAlternative
              ? { name: selectedAlternative.name, servingText: selectedAlternative.servingText }
              : meal.recommendation;
            const displayedNutrition = selectedAlternative?.nutrition ?? meal.nutrition;
            const substitutionGroups: PracticalSubstitutionGroup[] =
              selectedAlternative?.practicalSubstitutions ?? meal.practicalSubstitutions;

            return (
            <li key={meal.slot} className="rounded-control border border-ink/8 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold capitalize text-rose-strong">
                    {mealSlotLabel(meal.slot)} · {meal.scheduledTime}
                  </p>
                  <p className="text-sm font-semibold text-ink">
                    {displayedRecommendation.name}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {displayedRecommendation.servingText}
                  </p>
                </div>
                <p className="shrink-0 text-right text-xs text-ink-muted">
                  {displayedNutrition.caloriesKcal} kcal
                  <br />
                  P {displayedNutrition.proteinG} g · C{" "}
                  {displayedNutrition.carbohydrateG ?? "—"} g · F{" "}
                  {displayedNutrition.fatG ?? "—"} g
                </p>
              </div>
              <ul className="mt-2 grid gap-1 text-xs text-ink-muted">
                {meal.why.map((reason: string) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              {meal.confirmedConsumption && (
                <p className="mt-2 text-xs text-ink">
                  Log terkonfirmasi: {meal.confirmedConsumption.entryCount} ·{" "}
                  {meal.confirmedConsumption.nutrition.caloriesKcal} kcal ·{" "}
                  {meal.confirmedConsumption.nutrition.proteinG} g protein
                </p>
              )}
              {selectedAlternative ? (
                <div className="mt-2 rounded-control bg-petal-soft px-3 py-2 text-xs text-ink">
                  <p className="font-semibold">Menu pengganti dipilih</p>
                  <p className="mt-1 text-ink-muted">
                    Sisa target belum dihitung ulang sampai menu ini kamu konfirmasi atau edit di Meal Log.
                  </p>
                  <Link href="/meal" className="mt-1 inline-block font-semibold text-rose-strong underline">
                    Konfirmasi / edit di Meal Log
                  </Link>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-xs font-medium text-ink">
                    Sisa setelah {mealSlotLabel(meal.slot)}: {meal.remainingAfterMeal.caloriesKcal} kcal ·{" "}
                    {meal.remainingAfterMeal.proteinG} g protein
                  </p>
                  {meal.nextMealImpact && (
                    <p className="mt-1 text-xs text-ink-muted">{meal.nextMealImpact}</p>
                  )}
                </>
              )}
              <button
                type="button"
                className="mt-3 min-h-11 w-full rounded-control border border-rose-strong/30 bg-petal-soft px-3 py-2 text-sm font-semibold text-rose-strong"
                aria-expanded={Boolean(openSlots[meal.slot])}
                aria-controls={`meal-alternatives-${meal.slot}`}
                onClick={() => setOpenSlots((current) => ({ ...current, [meal.slot]: !current[meal.slot] }))}
              >
                Ganti menu
              </button>
              {openSlots[meal.slot] && (
                <div id={`meal-alternatives-${meal.slot}`} className="mt-3 rounded-control bg-petal-soft/60 p-3">
                  <p className="text-sm font-semibold text-ink">
                    Nggak ada menu ini? Pilih yang paling gampang kamu dapetin hari ini 💗
                  </p>
                  {meal.alternatives.length === 0 ? (
                    <p className="mt-2 text-xs text-ink-muted">
                      Belum ada opsi ganti yang cocok. Kamu bisa input manual dulu ya 💗
                    </p>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {meal.alternatives.map((alternative: MealAlternative) => (
                        <button
                          type="button"
                          key={alternative.templateId}
                          aria-label={`Pilih ${alternative.name} untuk ${meal.slot}`}
                          className="min-h-16 rounded-control border border-rose-strong/25 bg-white/75 px-3 py-2 text-left text-xs text-ink"
                          onClick={() => selectAlternative(meal, alternative)}
                        >
                          <span className="block font-semibold">{alternative.name}</span>
                          <span className="block text-ink-muted">{alternative.servingText}</span>
                          <span className="mt-1 block text-ink-muted">
                            {alternative.nutrition.caloriesKcal} kcal · {alternative.nutrition.proteinG} g protein
                          </span>
                          <span className="mt-1 block font-medium text-rose-strong">
                            Katalog lokal{alternative.availability === "optional" ? " · opsional" : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedAlternative && (
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-rose-strong underline"
                      onClick={() => resetAlternative(meal)}
                    >
                      Pakai menu awal
                    </button>
                  )}
                  {substitutionGroups.length > 0 && (
                    <div className="mt-3 grid gap-3">
                      {substitutionGroups.map((group) => (
                        <div key={group.role}>
                          <p className="text-xs font-semibold text-ink">{roleLabels[group.role]}</p>
                          <ul className="mt-1 flex flex-wrap gap-1.5">
                            {group.options.slice(0, 4).map((option) => (
                              <li key={option.id} className="rounded-full border border-rose-strong/20 bg-white/75 px-2 py-1 text-xs text-ink-muted">
                                {option.label} · {option.nutritionStatus === "approved" ? "Katalog lokal" : "Perlu konfirmasi"}
                                {option.availability === "optional" ? " · opsional" : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {meal.officeLunchAdjustment && (
                <div className="mt-2 rounded-control bg-sky-soft px-2 py-2">
                  <p className="text-xs font-semibold text-ink">
                    Penyesuaian makan siang kantor
                  </p>
                  {meal.officeLunchAdjustment.plan.applicable ? (
                    <ul className="mt-1 grid gap-1 text-xs text-ink-muted">
                      {meal.officeLunchAdjustment.plan.recommendations.map(
                        (item: OfficeLunchRecommendation) => (
                          <li key={item.itemKey}>
                            {item.action}: {item.label} · {item.serving}
                          </li>
                        ),
                      )}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-ink-muted">
                      {meal.officeLunchAdjustment.plan.reason}
                    </p>
                  )}
                </div>
              )}
            </li>
            );
          })}
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
  const metrics = plan.metrics;
  const primary: Array<[string, MetricValue | GoalMetricValue]> = [
    ["Skor coach", metrics.coachScore],
    ["Kalori", metrics.calories],
    ["Protein", metrics.protein],
    ["Air", metrics.water],
    ["Tidur", metrics.sleep],
    ["Workout", metrics.workout],
  ];
  const secondary: Array<[string, MetricValue]> = [
    ["Berat", metrics.body.weightKg],
    ["Lingkar pinggang", metrics.body.waistCm],
    ["BMR", metrics.body.bmrKcal],
    ["TDEE", metrics.body.tdeeKcal],
    ["Defisit", metrics.body.deficitKcal],
  ];
  return (
    <GlassCard>
      <section aria-labelledby="today-metrics-heading">
        <h2 id="today-metrics-heading" className="text-base font-semibold text-ink">
          Ringkasan kesehatan
        </h2>
        <p className="mt-1 text-xs text-ink-muted">Progress utama hari ini</p>
        <dl className="mt-3 grid grid-cols-2 divide-x divide-y divide-ink/8 overflow-hidden rounded-control border border-ink/8 sm:grid-cols-3">
          {primary.map(([label, metric]) => (
            <div key={label} className="min-w-0 px-3 py-3">
              <dt className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
                {label}
                <MetricStatusLabel metric={metric} />
              </dt>
              <dd className="mt-1 text-base font-semibold text-ink">
                {formatMetricValue(metric)}
              </dd>
              {"target" in metric && metric.target !== null && (
                <p className="mt-1 text-xs text-ink-muted">
                  Target {metric.target} {metric.unit}
                  {metric.remaining !== null
                    ? ` · ${metric.remaining} ${metric.unit} remaining`
                    : ""}
                </p>
              )}
            </div>
          ))}
        </dl>
        <div className="mt-4 border-t border-ink/8 pt-4">
          <p className="text-xs font-semibold text-ink">
            Tubuh &amp; energi
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-5">
            {secondary.map(([label, metric]) => (
              <div key={label} className="min-w-0">
                <dt className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
                  {label}
                  <MetricStatusLabel metric={metric} />
                </dt>
                <dd className="mt-1 text-sm font-semibold text-ink">
                  {formatMetricValue(metric)}
                </dd>
              </div>
            ))}
          </dl>
          {metrics.body.trend && (
            <p className="mt-3 text-xs text-ink-muted">
              Weight trend: {metrics.body.trend.direction}{" "}
              ({metrics.body.trend.change > 0 ? "+" : ""}
              {metrics.body.trend.change} {metrics.body.trend.unit})
            </p>
          )}
        </div>
        <p role="status" className="mt-3 text-xs text-ink-muted">
          Air yang ditambahkan sesi ini: {quickWaterMl} ml.
        </p>
      </section>
    </GlassCard>
  );
}

function formatMetricValue(metric: MetricValue): string {
  if (metric.value === null) return "Belum tersedia";
  return `${metric.value.toLocaleString("id-ID")} ${metric.unit}`;
}

function MetricStatusLabel({ metric }: { metric: MetricValue }) {
  if (metric.status === "ready") return null;
  return (
    <span className="rounded-full bg-bg-elevated px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
      {metricStatusLabel(metric.status)}
    </span>
  );
}

function TodayMotivation({ plan }: { plan: TodayCoachPlan }) {
  return (
    <GlassCard padding="sm">
      <section aria-labelledby="today-motivation-heading">
        <h2 id="today-motivation-heading" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Sparkles size={16} className="text-amber" />
          Semangat hari ini
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          {friendlyCoachText(
            plan.briefing.encouragement?.value ??
              "Pelan-pelan aja, satu langkah kecil tetap berarti 💗",
          )}
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
          Catat cepat
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Tambah air tanpa pindah halaman.
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
              Tambah {amount} ml air
            </Button>
          ))}
        </div>
        <p role="status" className="mt-3 text-xs text-ink-muted">
          Sudah dicatat dari aksi cepat: {loggedWaterMl} ml.
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

function friendlyCoachText(value: string): string {
  if (/infinity\s+days?\s+since\s+the\s+last\s+workout/i.test(value)) {
    return "Belum ada workout yang tercatat.";
  }
  if (/coach score has declined/i.test(value)) {
    return "Beberapa hari ini ritmenya agak turun. Kita mulai dari yang paling gampang dulu ya 💗";
  }
  return value.replace(/\bInfinity\b/gi, "belum ada data");
}

function mealSlotLabel(slot: string): string {
  return {
    breakfast: "sarapan",
    lunch: "makan siang",
    snack: "snack",
    dinner: "makan malam",
  }[slot] ?? slot;
}

function timelineStatusLabel(status: string): string {
  return {
    upcoming: "akan datang",
    completed: "selesai",
    missed: "terlewat",
    adjusted: "disesuaikan",
  }[status] ?? status;
}

function metricStatusLabel(status: MetricValue["status"]): string {
  return {
    ready: "siap",
    empty: "kosong",
    unavailable: "belum tersedia",
    estimated: "estimasi",
  }[status];
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
