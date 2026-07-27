import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { clampPercent, formatCalories, formatGrams } from "@/lib/utils/format";
import type { MealMacro } from "@/types/firestore";

export interface DailyNutritionSummaryProps {
  totals: MealMacro;
  calorieGoal: number;
  proteinGoalG: number;
}

interface MacroRowProps {
  label: string;
  value: string;
  progressPercent?: number;
  tone?: "rose" | "teal" | "amber";
}

function MacroRow({ label, value, progressPercent, tone = "rose" }: MacroRowProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-muted">{label}</span>
        <span className="text-sm font-semibold text-ink">{value}</span>
      </div>
      {typeof progressPercent === "number" && <ProgressBar value={progressPercent} tone={tone} label={label} />}
    </div>
  );
}

export function DailyNutritionSummary({ totals, calorieGoal, proteinGoalG }: DailyNutritionSummaryProps) {
  const remainingCalories = Math.max(calorieGoal - totals.calories, 0);
  const remainingProtein = Math.max(proteinGoalG - totals.proteinG, 0);

  return (
    <GlassCard className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Today&apos;s nutrition</p>

      <MacroRow
        label="Calories"
        value={formatCalories(totals.calories)}
        progressPercent={calorieGoal > 0 ? clampPercent((totals.calories / calorieGoal) * 100) : 0}
        tone="rose"
      />
      <MacroRow
        label="Protein"
        value={formatGrams(totals.proteinG)}
        progressPercent={proteinGoalG > 0 ? clampPercent((totals.proteinG / proteinGoalG) * 100) : 0}
        tone="teal"
      />
      <MacroRow label="Carbs" value={formatGrams(totals.carbsG)} />
      <MacroRow label="Fat" value={formatGrams(totals.fatG)} />
      <MacroRow label="Fiber" value={formatGrams(totals.fiberG ?? 0)} />

      <div className="mt-1 grid grid-cols-2 gap-3 border-t border-ink/8 pt-4">
        <div>
          <p className="text-xs text-ink-muted">Remaining calories</p>
          <p className="text-lg font-bold text-ink">{formatCalories(remainingCalories)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Remaining protein</p>
          <p className="text-lg font-bold text-ink">{formatGrams(remainingProtein)}</p>
        </div>
      </div>
    </GlassCard>
  );
}
