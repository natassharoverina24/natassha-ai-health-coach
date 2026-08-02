import { Clock, Droplets, Footprints, Moon, Timer, UtensilsCrossed } from "lucide-react";
import type { ReactNode } from "react";

import type { DailyPlan } from "@/lib/planner/plannerTypes";
import type { MealPlan } from "@/lib/planner/mealPlanner";

interface DailyPlanBriefingProps {
  dailyPlan: DailyPlan;
  mealPlan: MealPlan;
}

const MEAL_SLOTS = ["breakfast", "lunch", "snack", "dinner"] as const;
const SCHEDULE_SLOTS = [
  "breakfast",
  "lunch",
  "snack",
  "dinner",
  "workout",
  "waterReminder",
] as const;

export function DailyPlanBriefing({
  dailyPlan,
  mealPlan,
}: DailyPlanBriefingProps) {
  return (
    <section
      id="daily-meal-plan"
      aria-labelledby="daily-plan-heading"
      className="flex scroll-mt-6 flex-col gap-4"
    >
      <div>
        <h2
          id="daily-plan-heading"
          className="text-xs font-semibold uppercase tracking-wide text-ink-muted"
        >
          Today&apos;s plan
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Your retained coaching decisions, translated into a practical schedule.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <TargetItem
          icon={<UtensilsCrossed size={14} />}
          label="Calories"
          value={`${dailyPlan.targets.calories} kcal`}
        />
        <TargetItem
          icon={<UtensilsCrossed size={14} />}
          label="Protein"
          value={`${dailyPlan.targets.proteinG} g`}
        />
        <TargetItem
          icon={<Droplets size={14} />}
          label="Water"
          value={`${dailyPlan.targets.waterMl} ml`}
        />
        <TargetItem
          icon={<Timer size={14} />}
          label="Workout"
          value={`${dailyPlan.targets.workoutMin} min`}
        />
        <TargetItem
          icon={<Footprints size={14} />}
          label="Steps"
          value={dailyPlan.targets.steps.toLocaleString("id-ID")}
        />
        <TargetItem
          icon={<Moon size={14} />}
          label="Sleep"
          value={`${dailyPlan.targets.sleepHours} h`}
        />
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Schedule
        </h3>
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SCHEDULE_SLOTS.map((slot) => {
            const item = dailyPlan.schedule[slot];
            return (
              <li
                key={slot}
                className="flex items-center gap-2 rounded-control bg-taupe-soft px-3 py-2 text-sm"
              >
                <Clock size={13} className="shrink-0 text-rose-strong" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">
                    {item.label}
                  </span>
                  <span className="text-xs text-ink-muted">{item.time}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Meals
        </h3>
        <ul className="mt-2 grid gap-2 md:grid-cols-2">
          {MEAL_SLOTS.map((slot) => {
            const recommendation = mealPlan[slot];
            return (
              <li
                key={slot}
                className="rounded-control border border-ink/8 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-rose-strong">
                      {slot.charAt(0).toUpperCase() + slot.slice(1)}
                    </p>
                    <p className="text-sm font-semibold text-ink">
                      {recommendation.template.name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {recommendation.template.serving}
                    </p>
                  </div>
                  <p
                    aria-label={`${recommendation.template.calories} kilocalories and ${recommendation.template.proteinG} grams protein`}
                    className="shrink-0 text-right text-xs text-ink-muted"
                  >
                    {recommendation.template.calories} kcal
                    <br />
                    {recommendation.template.proteinG} g protein
                  </p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                  {recommendation.reason}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function TargetItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-control bg-taupe-soft px-3 py-2">
      <span className="text-rose-strong">{icon}</span>
      <span>
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
          {label}
        </span>
        <span className="text-sm font-semibold text-ink">{value}</span>
      </span>
    </div>
  );
}
