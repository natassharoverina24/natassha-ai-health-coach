"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Circle, Pill, Plus, Trash2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreCollection } from "@/hooks";
import { supplementsRepository, supplementLogsRepository } from "@/lib/db/supplements.repository";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { todayISODate } from "@/lib/utils/format";
import type { SupplementDefinition, SupplementLog } from "@/types/firestore";

export default function SupplementsPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const today = useMemo(() => todayISODate(), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: supplements, loading } = useFirestoreCollection<SupplementDefinition>(
    uid ? (onData, onError) => supplementsRepository.subscribeActiveForUser(uid, onData, onError) : null,
    [uid],
  );

  const { data: logs } = useFirestoreCollection<SupplementLog>(
    uid
      ? (onData, onError) => supplementLogsRepository.subscribeForUserByDate(uid, today, onData, onError)
      : null,
    [uid, today],
  );

  const logBySupplementId = new Map(logs.map((l) => [l.supplementId, l]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!uid || !name.trim()) return;
    setSubmitting(true);
    try {
      await supplementsRepository.create({
        userId: uid,
        name: name.trim(),
        dosage: dosage.trim() || "1x",
        frequency: "daily",
        timesOfDay: [],
        active: true,
      });
      setName("");
      setDosage("");
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (supplementId: string) => {
    if (!uid) return;
    const existing = logBySupplementId.get(supplementId);
    if (existing) {
      await supplementLogsRepository.update(existing.id, {
        taken: !existing.taken,
        takenAt: !existing.taken ? new Date().toISOString() : null,
      });
    } else {
      await supplementLogsRepository.create({
        userId: uid,
        supplementId,
        date: today,
        taken: true,
        takenAt: new Date().toISOString(),
      });
    }
  };

  const handleRemove = async (id: string) => {
    await supplementsRepository.update(id, { active: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Supplements"
        description="Today's checklist."
        action={
          <Button leadingIcon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
            Add supplement
          </Button>
        }
      />

      {loading ? (
        <Skeleton className="h-48 w-full rounded-card" />
      ) : supplements.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={<Pill size={28} />}
            title="No supplements yet"
            description="Add the supplements you take regularly to track daily adherence."
          />
        </GlassCard>
      ) : (
        <GlassCard padding="none" className="overflow-hidden">
          <ul className="divide-y divide-ink/8">
            {supplements.map((s) => {
              const taken = logBySupplementId.get(s.id)?.taken ?? false;
              return (
                <li key={s.id} className="flex items-center gap-3 px-5 py-4">
                  <button
                    onClick={() => void handleToggle(s.id)}
                    aria-label={taken ? "Mark as not taken" : "Mark as taken"}
                    className={taken ? "text-success" : "text-ink-faint"}
                  >
                    {taken ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                  </button>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink">{s.name}</p>
                    <p className="text-xs text-ink-muted">{s.dosage} · daily</p>
                  </div>
                  <button
                    onClick={() => void handleRemove(s.id)}
                    aria-label="Remove supplement"
                    className="rounded-full p-2 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </GlassCard>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add supplement">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input label="Name" placeholder="e.g. Vitamin D3" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Dosage" placeholder="e.g. 1000 IU" value={dosage} onChange={(e) => setDosage(e.target.value)} />
          <div className="mt-2 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={submitting} disabled={!name.trim()}>
              Add
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
