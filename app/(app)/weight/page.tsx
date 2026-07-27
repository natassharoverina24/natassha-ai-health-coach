"use client";

import { useState } from "react";
import { Plus, Scale, Trash2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreCollection } from "@/hooks";
import { weightsRepository } from "@/lib/db/weights.repository";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { WeightEntryForm, type WeightFormValues } from "@/components/forms/WeightEntryForm";
import { formatDateLabel, formatDelta } from "@/lib/utils/format";
import type { WeightEntry } from "@/types/firestore";

export default function WeightPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [modalOpen, setModalOpen] = useState(false);

  const { data: weights, loading } = useFirestoreCollection<WeightEntry>(
    uid ? (onData, onError) => weightsRepository.subscribeForUser(uid, onData, onError, 60) : null,
    [uid],
  );

  const handleCreate = async (values: WeightFormValues) => {
    if (!uid) return;
    await weightsRepository.create({
      userId: uid,
      date: values.date,
      weightKg: values.weightKg,
      bodyFatPercent: values.bodyFatPercent,
      muscleMassKg: null,
      note: values.note,
      source: "manual",
    });
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    await weightsRepository.remove(id);
  };

  const chartData = [...weights]
    .reverse()
    .map((w) => ({ label: formatDateLabel(w.date), value: w.weightKg }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Weight"
        description="Track your weight over time and watch the trend."
        action={
          <Button leadingIcon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
            Log weight
          </Button>
        }
      />

      {loading ? (
        <Skeleton className="h-56 w-full rounded-card" />
      ) : weights.length > 1 ? (
        <GlassCard>
          <TrendLineChart data={chartData} />
        </GlassCard>
      ) : null}

      <GlassCard padding="none" className="overflow-hidden">
        {loading ? (
          <div className="flex flex-col gap-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-control" />
            ))}
          </div>
        ) : weights.length === 0 ? (
          <div className="p-2">
            <EmptyState
              icon={<Scale size={28} />}
              title="No weight logged yet"
              description="Tap “Log weight” to add your first entry — your trend will build from here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-ink/8">
            {weights.map((entry, index) => {
              const prev = weights[index + 1];
              const delta = prev ? entry.weightKg - prev.weightKg : 0;
              return (
                <li key={entry.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">{entry.weightKg.toFixed(1)} kg</p>
                    <p className="text-xs text-ink-muted">{formatDateLabel(entry.date)}</p>
                    {entry.note && <p className="mt-0.5 text-xs text-ink-faint">{entry.note}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {prev && (
                      <span
                        className={
                          delta < 0 ? "text-xs font-semibold text-success" : delta > 0 ? "text-xs font-semibold text-danger" : "text-xs font-semibold text-ink-muted"
                        }
                      >
                        {formatDelta(delta)}
                      </span>
                    )}
                    <button
                      onClick={() => void handleDelete(entry.id)}
                      aria-label="Delete entry"
                      className="rounded-full p-2 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log weight">
        <WeightEntryForm onSubmit={handleCreate} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
