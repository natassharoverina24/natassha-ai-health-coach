"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { OfficeLunchOptimizerFlow } from "@/components/dashboard/OfficeLunchOptimizerFlow";
import { AutoShoppingList } from "@/components/shopping";
import {
  calculateEnergy,
  type ActivityLevel,
  type EnergyCalculatorResult,
  type EnergyCalculatorSex,
} from "@/lib/coach";
import type { CoachDecision } from "@/lib/engines/decisionEngine";
import {
  applyAdaptiveAdjustments,
  generateEmergencyPlan,
  generateWeeklyMealPrep,
  type AdaptiveAdjustmentResult,
  type DailyPlan,
  type EmergencyDisruption,
  type EmergencyPlanResult,
  type MealPlan,
  type MealSlot,
  type PlannerUserContext,
  type WeeklyMealPrepResult,
} from "@/lib/planner";
import {
  buildShoppingListFromMealPlan,
  readMealReplacementSelections,
} from "@/lib/shopping-list";

interface PlanningToolsPanelProps {
  userId?: string | null;
  decision: CoachDecision;
  context: PlannerUserContext;
  dailyPlan: DailyPlan;
  mealPlan: MealPlan;
}

type EnergyFields = {
  weightKg: string;
  heightCm: string;
  age: string;
  sex: EnergyCalculatorSex;
  activityLevel: ActivityLevel;
};

const EMPTY_ENERGY_FIELDS: EnergyFields = {
  weightKg: "",
  heightCm: "",
  age: "",
  sex: "female",
  activityLevel: "sedentary",
};

const DISRUPTION_TYPES: EmergencyDisruption["type"][] = [
  "missed-breakfast",
  "late-dinner",
  "overtime",
  "restaurant",
  "mall-trip",
  "travel",
  "birthday",
  "wedding",
];

const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];

function labelFromCode(value: string): string {
  return value.replaceAll("-", " ").replaceAll(".", " ");
}

function buildDisruption(
  type: EmergencyDisruption["type"],
  clock: string,
  mealSlot: "lunch" | "dinner",
  affectedSlots: MealSlot[],
): EmergencyDisruption {
  switch (type) {
    case "missed-breakfast":
      return { type, occurredAt: clock };
    case "late-dinner":
      return { type, expectedDinnerAt: clock };
    case "overtime":
      return { type, expectedEndAt: clock };
    case "travel":
      return { type, affectedSlots };
    case "restaurant":
    case "mall-trip":
    case "birthday":
    case "wedding":
      return { type, mealSlot };
  }
}

export function PlanningToolsPanel({
  userId = null,
  decision,
  context,
  dailyPlan,
  mealPlan,
}: PlanningToolsPanelProps) {
  const [energyFields, setEnergyFields] =
    useState<EnergyFields>(EMPTY_ENERGY_FIELDS);
  const [energyResult, setEnergyResult] =
    useState<EnergyCalculatorResult | null>(null);
  const [disruptionType, setDisruptionType] =
    useState<EmergencyDisruption["type"]>("missed-breakfast");
  const [disruptionClock, setDisruptionClock] = useState("12:00");
  const [eventMealSlot, setEventMealSlot] =
    useState<"lunch" | "dinner">("lunch");
  const [travelSlots, setTravelSlots] = useState<MealSlot[]>(["lunch"]);
  const [emergencyResult, setEmergencyResult] =
    useState<EmergencyPlanResult | null>(null);

  const weeklyResult = useMemo<WeeklyMealPrepResult>(
    () =>
      generateWeeklyMealPrep({
        decision,
        context,
        officeLunchByDate: {},
        ingredientCatalogue: {},
      }),
    [context, decision],
  );

  const adaptiveResult = useMemo<AdaptiveAdjustmentResult>(
    () =>
      applyAdaptiveAdjustments({
        plan: {
          date: context.today,
          dailyPlan,
          mealPlan,
        },
        decision,
      }),
    [context.today, dailyPlan, decision, mealPlan],
  );

  const handleEnergySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEnergyResult(
      calculateEnergy({
        weightKg: Number(energyFields.weightKg),
        heightCm: Number(energyFields.heightCm),
        age: Number(energyFields.age),
        sex: energyFields.sex,
        activityLevel: energyFields.activityLevel,
      }),
    );
  };

  const handleEmergencySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmergencyResult(
      generateEmergencyPlan(
        decision,
        context,
        buildDisruption(
          disruptionType,
          disruptionClock,
          eventMealSlot,
          travelSlots,
        ),
      ),
    );
  };

  const toggleTravelSlot = (slot: MealSlot) => {
    setTravelSlots((current) =>
      current.includes(slot)
        ? current.filter((item) => item !== slot)
        : [...current, slot],
    );
  };

  const needsClock =
    disruptionType === "missed-breakfast" ||
    disruptionType === "late-dinner" ||
    disruptionType === "overtime";
  const needsEventSlot =
    disruptionType === "restaurant" ||
    disruptionType === "mall-trip" ||
    disruptionType === "birthday" ||
    disruptionType === "wedding";

  return (
    <section
      aria-labelledby="planning-tools-heading"
      className="flex flex-col gap-4 border-t border-ink/8 pt-4"
    >
      <div>
        <h2
          id="planning-tools-heading"
          className="text-xs font-semibold uppercase tracking-wide text-ink-muted"
        >
          Planning tools
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Structured inputs are evaluated by the deterministic planning layer.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PlannerCard id="energy-calculator" title="Energy calculator">
          <form
            aria-label="Energy calculator"
            className="grid gap-3 sm:grid-cols-3"
            onSubmit={handleEnergySubmit}
          >
            <Input
              id="energy-weight"
              label="Weight"
              type="number"
              min="0"
              step="any"
              value={energyFields.weightKg}
              onChange={(event) =>
                setEnergyFields((current) => ({
                  ...current,
                  weightKg: event.target.value,
                }))
              }
              suffix="kg"
            />
            <Input
              id="energy-height"
              label="Height"
              type="number"
              min="0"
              step="any"
              value={energyFields.heightCm}
              onChange={(event) =>
                setEnergyFields((current) => ({
                  ...current,
                  heightCm: event.target.value,
                }))
              }
              suffix="cm"
            />
            <Input
              id="energy-age"
              label="Age"
              type="number"
              min="0"
              step="any"
              value={energyFields.age}
              onChange={(event) =>
                setEnergyFields((current) => ({
                  ...current,
                  age: event.target.value,
                }))
              }
            />
            <SelectField
              id="energy-sex"
              label="Sex"
              value={energyFields.sex}
              onChange={(value) =>
                setEnergyFields((current) => ({
                  ...current,
                  sex: value as EnergyCalculatorSex,
                }))
              }
              options={[
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
              ]}
            />
            <SelectField
              id="energy-activity"
              label="Activity level"
              value={energyFields.activityLevel}
              onChange={(value) =>
                setEnergyFields((current) => ({
                  ...current,
                  activityLevel: value as ActivityLevel,
                }))
              }
              options={[
                { value: "sedentary", label: "Sedentary" },
                { value: "light", label: "Light" },
                { value: "moderate", label: "Moderate" },
                { value: "active", label: "Active" },
                { value: "very-active", label: "Very active" },
              ]}
            />
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Calculate
              </Button>
            </div>
          </form>
          <EnergyResultView result={energyResult} />
        </PlannerCard>

        <PlannerCard id="office-lunch-optimizer" title="Office lunch optimizer">
          <OfficeLunchOptimizerFlow decision={decision} context={context} />
        </PlannerCard>

        <PlannerCard id="weekly-meal-plan" title="Weekly meal plan">
          <WeeklyResultView result={weeklyResult} userId={userId} />
        </PlannerCard>

        <PlannerCard title="Emergency planner">
          <form
            aria-label="Emergency planner"
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={handleEmergencySubmit}
          >
            <SelectField
              id="emergency-type"
              label="Disruption"
              value={disruptionType}
              onChange={(value) =>
                setDisruptionType(value as EmergencyDisruption["type"])
              }
              options={DISRUPTION_TYPES.map((value) => ({
                value,
                label: labelFromCode(value),
              }))}
            />
            {needsClock && (
              <Input
                id="emergency-time"
                label="Time"
                type="time"
                value={disruptionClock}
                onChange={(event) => setDisruptionClock(event.target.value)}
              />
            )}
            {needsEventSlot && (
              <SelectField
                id="emergency-slot"
                label="Affected meal"
                value={eventMealSlot}
                onChange={(value) =>
                  setEventMealSlot(value as "lunch" | "dinner")
                }
                options={[
                  { value: "lunch", label: "Lunch" },
                  { value: "dinner", label: "Dinner" },
                ]}
              />
            )}
            {disruptionType === "travel" && (
              <fieldset className="sm:col-span-2">
                <legend className="text-sm font-medium text-ink">
                  Affected meal slots
                </legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  {MEAL_SLOTS.map((slot) => (
                    <label
                      key={slot}
                      className="flex items-center gap-2 text-sm text-ink"
                    >
                      <input
                        type="checkbox"
                        checked={travelSlots.includes(slot)}
                        onChange={() => toggleTravelSlot(slot)}
                      />
                      {slot.charAt(0).toUpperCase() + slot.slice(1)}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="flex items-end sm:col-span-2">
              <Button type="submit">Generate fallback</Button>
            </div>
          </form>
          <EmergencyResultView result={emergencyResult} />
        </PlannerCard>

        <PlannerCard title="Adaptive adjustments">
          <AdaptiveResultView result={adaptiveResult} />
        </PlannerCard>
      </div>
    </section>
  );
}

function PlannerCard({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-control border border-ink/8 p-4"
    >
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-control border border-ink/10 bg-bg-elevated px-4 text-sm text-ink focus:border-rose"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusMessage({
  tone,
  children,
}: {
  tone: "neutral" | "error";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-control bg-danger/10 px-3 py-2 text-sm text-danger"
          : "rounded-control bg-teal-soft px-3 py-2 text-sm text-ink"
      }
    >
      {children}
    </p>
  );
}

function EnergyResultView({ result }: { result: EnergyCalculatorResult | null }) {
  if (!result) {
    return (
      <StatusMessage tone="neutral">
        Enter metric values to calculate informational BMR and TDEE.
      </StatusMessage>
    );
  }
  if (result.status === "invalid-input") {
    return (
      <StatusMessage tone="error">
        Check: {result.errors.map(labelFromCode).join(", ")}.
      </StatusMessage>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2" role="status">
      <OutputValue label="BMR" value={`${result.bmrCalories} kcal`} />
      <OutputValue label="TDEE" value={`${result.tdeeCalories} kcal`} />
      <p className="col-span-2 text-xs text-ink-muted">
        Informational only · Mifflin–St Jeor · activity factor{" "}
        {result.activityFactor}
      </p>
    </div>
  );
}

function WeeklyResultView({
  result,
  userId,
}: {
  result: WeeklyMealPrepResult;
  userId: string | null;
}) {
  if (result.status === "invalid-input") {
    const missingMappings = result.errors.filter(
      (error) => error.code === "missing-template-ingredients",
    );
    if (missingMappings.length > 0) {
      const shoppingResult = buildShoppingListFromMealPlan({
        days: result.days ?? [],
        selectedReplacements: userId
          ? readMealReplacementSelections(userId)
          : [],
      });
      return (
        <div className="flex flex-col gap-3">
          <StatusMessage tone="neutral">
            Daftar belanja dibuat dari meal plan mingguanmu 💗
          </StatusMessage>
          {result.days && <WeeklyDays days={result.days} />}
          <AutoShoppingList result={shoppingResult} />
        </div>
      );
    }
    return (
      <StatusMessage tone="error">
        Weekly plan input is invalid:{" "}
        {result.errors.map((error) => labelFromCode(error.code)).join(", ")}.
      </StatusMessage>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-ink">
        {result.startDate} to {result.endDate}
      </p>
      <p className="text-xs text-ink-muted">
        {result.days.length} days · {result.shoppingList.length} shopping items ·{" "}
        {result.batchCookingOpportunities.length} batch opportunities
      </p>
      <WeeklyDays days={result.days} />
    </div>
  );
}

function WeeklyDays({
  days,
}: {
  days: NonNullable<
    Extract<WeeklyMealPrepResult, { status: "invalid-input" }>["days"]
  >;
}) {
  const slots: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];
  return (
    <ol aria-label="Seven-day meal plan" className="grid gap-3">
      {days.map((day) => (
        <li key={day.date} className="rounded-control border border-ink/8 p-3">
          <h4 className="text-sm font-semibold text-ink">{day.date}</h4>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {slots.map((slot) => {
              const recommendation = day.mealPlan[slot];
              return (
                <li key={slot} className="min-w-0 rounded-control bg-teal-soft px-3 py-2">
                  <p className="text-xs font-semibold uppercase text-teal">
                    {slot}
                  </p>
                  <p className="truncate text-sm font-semibold text-ink">
                    {recommendation.template.name}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {recommendation.template.serving}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {recommendation.template.calories} kcal ·{" "}
                    {recommendation.template.proteinG} g protein
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {recommendation.reason}
                  </p>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function EmergencyResultView({ result }: { result: EmergencyPlanResult | null }) {
  if (!result) {
    return (
      <StatusMessage tone="neutral">
        Select a current disruption to generate a deterministic fallback.
      </StatusMessage>
    );
  }
  if (result.status === "invalid-input") {
    return (
      <StatusMessage tone="error">
        Check: {result.errors.map((error) => labelFromCode(error.code)).join(", ")}.
      </StatusMessage>
    );
  }
  if (result.status === "not-applicable") {
    return (
      <StatusMessage tone="neutral">
        No safe fallback is applicable: {labelFromCode(result.reason)}.
      </StatusMessage>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {result.actions.map((action, index) => (
        <li
          key={`${action.slot}-${index}`}
          className="rounded-control bg-teal-soft px-3 py-2 text-sm text-ink"
        >
          <span className="font-semibold">
            {action.slot.charAt(0).toUpperCase() + action.slot.slice(1)}:
          </span>{" "}
          {action.kind === "approved-template"
            ? `${action.recommendation.template.name} — ${action.recommendation.reason}`
            : `${action.components.join(" + ")} — ${action.reason}`}
        </li>
      ))}
    </ul>
  );
}

function AdaptiveResultView({ result }: { result: AdaptiveAdjustmentResult }) {
  if (result.status === "invalid-input") {
    return (
      <StatusMessage tone="error">
        Adaptive plan input is invalid:{" "}
        {result.errors.map((error) => labelFromCode(error.code)).join(", ")}.
      </StatusMessage>
    );
  }
  if (result.status === "not-applicable") {
    return (
      <StatusMessage tone="neutral">
        No retained adaptive adjustment applies today.
      </StatusMessage>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {result.adjustments.map((adjustment) => (
        <li
          key={`${adjustment.type}-${adjustment.reasonInsightId}`}
          className="rounded-control bg-teal-soft px-3 py-2 text-sm text-ink"
        >
          {labelFromCode(adjustment.type)} · retained insight{" "}
          {adjustment.reasonInsightId}
        </li>
      ))}
    </ul>
  );
}

function OutputValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control bg-teal-soft px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
