import { Sparkles, TrendingDown, TrendingUp, Minus } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
import type { CoachScoreSummary } from "@/lib/coach/types";
import { cn } from "@/lib/utils/cn";

export interface CoachScoreCardProps {
  summary: CoachScoreSummary;
}

const TREND_CONFIG = {
  up: { Icon: TrendingUp, className: "text-success", label: "Trending up" },
  down: { Icon: TrendingDown, className: "text-amber", label: "Trending down" },
  flat: { Icon: Minus, className: "text-ink-muted", label: "Holding steady" },
} as const;

export function CoachScoreCard({ summary }: CoachScoreCardProps) {
  const trend = TREND_CONFIG[summary.trend];
  const TrendIcon = trend.Icon;

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Coach score</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-petal-soft text-rose-strong">
          <Sparkles size={16} />
        </span>
      </div>

      <div className="flex items-end gap-6">
        <div>
          <p className="text-xs text-ink-muted">Today</p>
          <p className="text-4xl font-bold text-ink">
            {summary.currentScore != null ? summary.currentScore : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">7-day average</p>
          <p className="text-2xl font-semibold text-ink">{summary.weeklyAverage}</p>
        </div>
      </div>

      <div className={cn("flex items-center gap-1.5 text-sm font-medium", trend.className)}>
        <TrendIcon size={16} />
        {trend.label}
        <span className="text-ink-faint">
          (previous week {summary.previousWeeklyAverage})
        </span>
      </div>
    </GlassCard>
  );
}
