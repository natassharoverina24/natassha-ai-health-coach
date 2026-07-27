import { TrendingUp } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrendLineChart, type TrendPoint } from "@/components/charts/TrendLineChart";

export interface WeeklyProgressCardProps {
  data: TrendPoint[];
  unit?: string;
}

export function WeeklyProgressCard({ data, unit = " kg" }: WeeklyProgressCardProps) {
  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Weekly progress
          </p>
          <p className="text-lg font-bold text-ink">Weight trend</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-petal-soft text-rose-strong">
          <TrendingUp size={18} />
        </span>
      </div>

      {data.length > 1 ? (
        <TrendLineChart data={data} unit={unit} />
      ) : (
        <EmptyState
          title="No entries yet this week"
          description="Log your weight to see your trend line come to life here."
        />
      )}
    </GlassCard>
  );
}
