import { Droplets, Trash2 } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { clampPercent, formatMilliliters } from "@/lib/utils/format";
import { WATER_QUICK_AMOUNTS_ML } from "@/lib/utils/nutritionEstimates";
import type { WaterLogEntry } from "@/types/firestore";

export interface WaterTrackerCardProps {
  entries: WaterLogEntry[];
  goalMl: number;
  onQuickAdd: (amountMl: number) => void;
  onDelete: (id: string) => void;
  addingAmountMl: number | null;
}

export function WaterTrackerCard({
  entries,
  goalMl,
  onQuickAdd,
  onDelete,
  addingAmountMl,
}: WaterTrackerCardProps) {
  const totalMl = entries.reduce((sum, e) => sum + e.amountMl, 0);
  const progressPercent = goalMl > 0 ? clampPercent((totalMl / goalMl) * 100) : 0;

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Water</p>
          <p className="text-lg font-bold text-ink">
            {formatMilliliters(totalMl)}
            <span className="ml-1 text-sm font-medium text-ink-muted">/ {formatMilliliters(goalMl)}</span>
          </p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-soft text-teal">
          <Droplets size={18} />
        </span>
      </div>

      <ProgressBar value={progressPercent} tone="teal" label="Water intake" />

      <div className="grid grid-cols-4 gap-2">
        {WATER_QUICK_AMOUNTS_ML.map((amount) => (
          <Button
            key={amount}
            size="sm"
            variant="secondary"
            isLoading={addingAmountMl === amount}
            onClick={() => onQuickAdd(amount)}
          >
            +{amount >= 1000 ? `${amount / 1000}L` : `${amount}ml`}
          </Button>
        ))}
      </div>

      {entries.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-ink/8 pt-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">{formatMilliliters(entry.amountMl)}</span>
              <button
                onClick={() => onDelete(entry.id)}
                aria-label="Delete water entry"
                className="rounded-full p-1.5 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
