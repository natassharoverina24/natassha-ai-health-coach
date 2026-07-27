import { HealthRings, HealthRingsLegend, type RingDatum } from "@/components/charts/HealthRings";
import { GlassCard } from "@/components/ui/GlassCard";

export interface HealthRingsCardProps {
  rings: RingDatum[];
  title?: string;
}

export function HealthRingsCard({ rings, title = "Today's rings" }: HealthRingsCardProps) {
  return (
    <GlassCard className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col items-center gap-3 sm:items-start">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{title}</p>
        <HealthRings rings={rings} />
      </div>
      <div className="w-full sm:w-40">
        <HealthRingsLegend rings={rings} />
      </div>
    </GlassCard>
  );
}
