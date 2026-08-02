"use client";

import { FileBarChart } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreCollection } from "@/hooks";
import { reportsRepository } from "@/lib/db/reports.repository";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCalories, formatDateLabel, formatGrams, formatPercent, formatWeightKg } from "@/lib/utils/format";
import type { ReportSummary } from "@/types/firestore";

export default function ReportsPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const { data: reports, loading } = useFirestoreCollection<ReportSummary>(
    uid ? (onData, onError) => reportsRepository.subscribeForUser(uid, onData, onError) : null,
    [uid],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="Weekly and monthly summaries of your progress, generated automatically."
      />

      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-card" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={<FileBarChart size={28} />}
            title="No reports yet"
            description="Once you've logged a full week of data, your first weekly report will appear here automatically."
          />
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((report) => (
            <GlassCard key={report.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">
                  {formatDateLabel(report.startDate)} – {formatDateLabel(report.endDate)}
                </p>
                <Badge tone={report.period === "weekly" ? "rose" : "taupe"}>{report.period}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <ReportStat label="Avg weight" value={report.avgWeightKg != null ? formatWeightKg(report.avgWeightKg) : "—"} />
                <ReportStat label="Change" value={report.weightDeltaKg != null ? formatWeightKg(report.weightDeltaKg) : "—"} />
                <ReportStat label="Avg calories" value={report.avgCalories != null ? formatCalories(report.avgCalories) : "—"} />
                <ReportStat label="Avg protein" value={report.avgProteinG != null ? formatGrams(report.avgProteinG) : "—"} />
                <ReportStat label="Meal score" value={report.mealScoreAvg != null ? report.mealScoreAvg.toFixed(0) : "—"} />
                <ReportStat
                  label="Supplement adherence"
                  value={report.supplementAdherencePercent != null ? formatPercent(report.supplementAdherencePercent) : "—"}
                />
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="font-semibold text-ink">{value}</p>
    </div>
  );
}
