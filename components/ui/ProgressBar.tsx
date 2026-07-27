import { cn } from "@/lib/utils/cn";
import { clampPercent } from "@/lib/utils/format";

export interface ProgressBarProps {
  value: number; // 0-100
  tone?: "rose" | "teal" | "amber";
  className?: string;
  label?: string;
}

const toneMap = {
  rose: "bg-rose",
  teal: "bg-teal",
  amber: "bg-amber",
};

export function ProgressBar({ value, tone = "rose", className, label }: ProgressBarProps) {
  const pct = clampPercent(value);
  return (
    <div className={cn("w-full", className)}>
      <div
        className="h-2 w-full overflow-hidden rounded-pill bg-ink/8"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-pill transition-all duration-500 ease-out", toneMap[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
