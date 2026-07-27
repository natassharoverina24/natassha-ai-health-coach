import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatDelta, formatPercent, formatSignedDelta } from "@/lib/utils/format";
import { DIMENSION_LABELS } from "@/lib/coach/kpi";
import type { WeeklyReview } from "@/lib/coach/types";

export interface WeeklyReviewCardProps {
  review: WeeklyReview;
}

interface ReviewRowProps {
  label: string;
  value: string;
  progressPercent?: number;
}

function ReviewRow({ label, value, progressPercent }: ReviewRowProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-muted">{label}</span>
        <span className="text-sm font-semibold text-ink">{value}</span>
      </div>
      {typeof progressPercent === "number" && (
        <ProgressBar value={progressPercent} tone="rose" label={label} />
      )}
    </div>
  );
}

/** "Weekly CEO Review" — the whole week's numbers in one honest glance, no interpretation, just the facts. */
export function WeeklyReviewCard({ review }: WeeklyReviewCardProps) {
  const { adherence } = review;

  return (
    <GlassCard className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Weekly CEO review</p>

      <div className="grid grid-cols-2 gap-4">
        <ReviewRow
          label="Weight change"
          value={review.weightChangeKg != null ? formatDelta(review.weightChangeKg) : "—"}
        />
        <ReviewRow
          label="Waist change"
          value={review.waistChangeCm != null ? formatSignedDelta(review.waistChangeCm, "cm") : "—"}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-ink/8 pt-4">
        <ReviewRow
          label={`${DIMENSION_LABELS.calories} adherence`}
          value={formatPercent(adherence.calories)}
          progressPercent={adherence.calories}
        />
        <ReviewRow
          label={`${DIMENSION_LABELS.protein} adherence`}
          value={formatPercent(adherence.protein)}
          progressPercent={adherence.protein}
        />
        <ReviewRow
          label={`${DIMENSION_LABELS.water} adherence`}
          value={formatPercent(adherence.water)}
          progressPercent={adherence.water}
        />
        <ReviewRow
          label={`${DIMENSION_LABELS.workout} adherence`}
          value={formatPercent(adherence.workout)}
          progressPercent={adherence.workout}
        />
        <ReviewRow
          label={`${DIMENSION_LABELS.sleep} adherence`}
          value={formatPercent(adherence.sleep)}
          progressPercent={adherence.sleep}
        />
        <ReviewRow
          label={`${DIMENSION_LABELS.mealLogging} adherence`}
          value={formatPercent(adherence.mealLogging)}
          progressPercent={adherence.mealLogging}
        />
      </div>
    </GlassCard>
  );
}
