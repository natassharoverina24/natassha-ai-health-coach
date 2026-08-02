import type { ReactNode } from "react";
import { Award, Compass, Flag, Target } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
import { formatPercent } from "@/lib/utils/format";
import type { KpiSummary } from "@/lib/coach/types";

export interface WeeklyKpiCardProps {
  kpi: KpiSummary;
}

interface KpiRowProps {
  icon: ReactNode;
  tone: "rose" | "taupe" | "amber";
  label: string;
  value: string;
}

const TONE_STYLES = {
  rose: "bg-petal-soft text-rose-strong",
  taupe: "bg-taupe-soft text-rose-strong",
  amber: "bg-amber-soft text-amber",
};

function KpiRow({ icon, tone, label, value }: KpiRowProps) {
  return (
    <div className="flex items-start gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE_STYLES[tone]}`}>
        {icon}
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="text-sm font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}

export function WeeklyKpiCard({ kpi }: WeeklyKpiCardProps) {
  const hasData = kpi.bestAchievement !== null;

  return (
    <GlassCard className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">This week&apos;s KPIs</p>

      {!hasData ? (
        <p className="text-sm text-ink-muted">
          Log a few days of data and your weekly highlights will show up here.
        </p>
      ) : (
        <>
          <KpiRow
            icon={<Award size={16} />}
            tone="rose"
            label="Best achievement"
            value={`${kpi.bestAchievement!.label} — ${formatPercent(kpi.bestAchievement!.percent)} adherence`}
          />
          <KpiRow
            icon={<Compass size={16} />}
            tone="amber"
            label="Biggest challenge"
            value={`${kpi.biggestChallenge!.label} — ${formatPercent(kpi.biggestChallenge!.percent)} adherence`}
          />
          <KpiRow
            icon={<Target size={16} />}
            tone="taupe"
            label="Improvement focus"
            value={kpi.improvementFocus!.label}
          />
          <KpiRow icon={<Flag size={16} />} tone="rose" label="Next week goal" value={kpi.nextWeekGoal ?? "—"} />
        </>
      )}
    </GlassCard>
  );
}
