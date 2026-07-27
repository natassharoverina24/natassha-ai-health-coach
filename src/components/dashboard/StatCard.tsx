import type { ReactNode } from "react";

import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils/cn";

export interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: ReactNode;
  tone?: "rose" | "teal" | "amber";
  progressPercent?: number; // 0-100, renders a thin progress bar when provided
  trend?: { label: string; direction: "up" | "down" | "flat" };
  className?: string;
  footer?: ReactNode;
}

const toneStyles = {
  rose: { bg: "bg-petal-soft", fg: "text-rose-strong" },
  teal: { bg: "bg-teal-soft", fg: "text-teal" },
  amber: { bg: "bg-amber-soft", fg: "text-amber" },
};

const trendStyles: Record<string, string> = {
  up: "text-success",
  down: "text-danger",
  flat: "text-ink-muted",
};

const trendGlyph: Record<string, string> = {
  up: "\u2191",
  down: "\u2193",
  flat: "\u2192",
};

export function StatCard({
  label,
  value,
  unit,
  icon,
  tone = "rose",
  progressPercent,
  trend,
  className,
  footer,
}: StatCardProps) {
  const styles = toneStyles[tone];

  return (
    <GlassCard className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <span
          className={cn("flex h-10 w-10 items-center justify-center rounded-full", styles.bg, styles.fg)}
        >
          {icon}
        </span>
        {trend && (
          <span className={cn("text-xs font-semibold", trendStyles[trend.direction])}>
            {trendGlyph[trend.direction]} {trend.label}
          </span>
        )}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-ink">{value}</span>
          {unit && <span className="text-sm font-medium text-ink-muted">{unit}</span>}
        </p>
      </div>

      {typeof progressPercent === "number" && (
        <ProgressBar value={progressPercent} tone={tone} label={label} />
      )}

      {footer}
    </GlassCard>
  );
}
