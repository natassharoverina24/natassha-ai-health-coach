import { Flame, Scale, Trophy } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateLabel } from "@/lib/utils/format";
import type { Milestone, MilestoneCategory } from "@/lib/coach/types";

export interface MilestonesListProps {
  milestones: Milestone[];
}

const CATEGORY_CONFIG: Record<MilestoneCategory, { icon: typeof Scale; tone: "rose" | "teal" | "amber"; label: string }> = {
  weight: { icon: Scale, tone: "rose", label: "Weight" },
  streak: { icon: Flame, tone: "amber", label: "Streak" },
  workout: { icon: Trophy, tone: "teal", label: "Workout" },
};

export function MilestonesList({ milestones }: MilestonesListProps) {
  return (
    <GlassCard className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Milestones</p>

      {milestones.length === 0 ? (
        <EmptyState
          icon={<Trophy size={22} />}
          title="No milestones yet"
          description="Keep logging — your first milestone is closer than you think."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {milestones.map((milestone) => {
            const config = CATEGORY_CONFIG[milestone.category];
            const Icon = config.icon;
            return (
              <li key={milestone.id} className="flex items-start gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    config.tone === "rose" ? "bg-petal-soft text-rose-strong" : config.tone === "teal" ? "bg-teal-soft text-teal" : "bg-amber-soft text-amber"
                  }`}
                >
                  <Icon size={16} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{milestone.title}</p>
                    <Badge tone={config.tone}>{config.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">{milestone.description}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">{formatDateLabel(milestone.achievedDate)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
