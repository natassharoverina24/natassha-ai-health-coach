"use client";

import { Clock3, Pill } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { GlassCard } from "@/components/ui/GlassCard";
import type {
  SupplementPlanItem,
  SupplementStatus,
} from "@/lib/supplements";

interface TodaySupplementPlanProps {
  plan: readonly SupplementPlanItem[];
  savingId?: string | null;
  onStatus: (
    item: SupplementPlanItem,
    status: Exclude<SupplementStatus, "planned">,
  ) => void | Promise<void>;
  onRemove?: (supplementId: string) => void | Promise<void>;
  onEdit?: (item: SupplementPlanItem) => void;
}

function scheduleLabel(item: SupplementPlanItem): string {
  if (item.schedule.timesOfDay.length === 0) return "Waktu fleksibel";
  return item.schedule.timesOfDay.join(", ");
}

export function TodaySupplementPlan({
  plan,
  savingId = null,
  onStatus,
  onRemove,
  onEdit,
}: TodaySupplementPlanProps) {
  if (plan.length === 0) {
    return (
      <GlassCard>
        <EmptyState
          icon={<Pill size={28} />}
          title="Belum ada supplement"
          description="Belum ada supplement yang kamu simpan. Nanti kalau sudah ada, aku bantu ingetin ya 💗"
        />
      </GlassCard>
    );
  }

  const resolved = plan.every(
    (item) => item.status === "taken" || item.status === "skipped",
  );

  return (
    <div className="flex flex-col gap-4">
      {resolved && (
        <GlassCard className="bg-petal-soft/60">
          <p role="status" className="text-sm font-semibold text-rose-strong">
            Hari ini sudah beres 💗
          </p>
        </GlassCard>
      )}

      <ul className="grid gap-3">
        {plan.map((item) => {
          const saving = savingId === item.supplementId;
          return (
            <li key={item.supplementId}>
              <GlassCard className="overflow-hidden">
                <div className="flex items-start gap-3">
                  <span className="rounded-full bg-petal-soft p-2 text-rose-strong">
                    <Pill size={18} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-ink">{item.name}</h2>
                        {item.doseText && (
                          <p className="mt-0.5 text-xs text-ink-muted">
                            Dosis tersimpan: {item.doseText}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-petal-soft px-2.5 py-1 text-xs font-semibold text-rose-strong">
                        {item.status === "planned"
                          ? "Direncanakan"
                          : item.status === "taken"
                            ? "Sudah diminum"
                            : item.status === "skipped"
                              ? "Skip hari ini"
                              : "Ingatkan nanti"}
                      </span>
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs text-ink-muted">
                      <Clock3 size={14} aria-hidden="true" />
                      {scheduleLabel(item)}
                    </p>
                    {item.note && (
                      <p className="mt-1 text-xs text-ink-muted">Catatanmu: {item.note}</p>
                    )}
                    <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                      {item.reminder}
                    </p>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void onStatus(item, "taken")}
                        className="min-h-11 rounded-control bg-rose-strong px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Sudah diminum
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void onStatus(item, "remind-later")}
                        className="min-h-11 rounded-control border border-rose-strong/30 bg-petal-soft px-3 py-2 text-sm font-semibold text-rose-strong disabled:opacity-50"
                      >
                        Nanti ingetin
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void onStatus(item, "skipped")}
                        className="min-h-11 rounded-control border border-ink/10 px-3 py-2 text-sm font-semibold text-ink-muted disabled:opacity-50"
                      >
                        Skip hari ini
                      </button>
                    </div>
                    {onRemove && (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {onEdit && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => onEdit(item)}
                            className="text-xs font-medium text-rose-strong underline"
                          >
                            Ubah jadwal
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void onRemove(item.supplementId)}
                          className="text-xs font-medium text-ink-faint underline"
                        >
                          Nonaktifkan supplement
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
