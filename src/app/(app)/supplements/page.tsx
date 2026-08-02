"use client";

import { useCallback, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Plus } from "lucide-react";

import { TodaySupplementPlan } from "@/components/supplements";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreCollection } from "@/hooks";
import {
  supplementsRepository,
  supplementLogsRepository,
} from "@/lib/db/supplements.repository";
import {
  buildTodaySupplementPlan,
  getSupplementReminderCopy,
  inferSupplementSuggestedTiming,
  type SupplementPlanItem,
  type SupplementStatus,
} from "@/lib/supplements";
import { todayISODate } from "@/lib/utils/format";
import type { SupplementDefinition, SupplementLog } from "@/types/firestore";

export default function SupplementsPage() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const today = useMemo(() => todayISODate(), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [doseText, setDoseText] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [timeWasManuallySet, setTimeWasManuallySet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [friendlyError, setFriendlyError] = useState<string | null>(null);
  const [optimisticStatuses, setOptimisticStatuses] = useState<
    Record<string, SupplementStatus>
  >({});
  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
  }, []);

  const timingSuggestion = useMemo(
    () =>
      inferSupplementSuggestedTiming(
        name,
        timeWasManuallySet ? timeOfDay : null,
      ),
    [name, timeOfDay, timeWasManuallySet],
  );

  const openCreateModal = () => {
    setEditingId(null);
    setName("");
    setDoseText("");
    setTimeOfDay("");
    setNote("");
    setTimeWasManuallySet(false);
    setModalOpen(true);
  };

  const openEditModal = (item: SupplementPlanItem) => {
    setEditingId(item.supplementId);
    setName(item.name);
    setDoseText(item.doseText ?? "");
    setTimeOfDay(item.schedule.timesOfDay[0] ?? "");
    setNote(item.note ?? "");
    setTimeWasManuallySet(item.schedule.timesOfDay.length > 0);
    setModalOpen(true);
  };

  const supplementsSource = useFirestoreCollection<SupplementDefinition>(
    userId
      ? (onData, onError) =>
          supplementsRepository.subscribeActiveForUser(userId, onData, onError)
      : null,
    [userId],
  );
  const logsSource = useFirestoreCollection<SupplementLog>(
    userId
      ? (onData, onError) =>
          supplementLogsRepository.subscribeForUserByDate(
            userId,
            today,
            onData,
            onError,
          )
      : null,
    [userId, today],
  );

  const basePlan = buildTodaySupplementPlan(
    supplementsSource.data,
    logsSource.data,
    today,
  );
  const plan = basePlan.map((item) => {
    const status = optimisticStatuses[item.supplementId];
    return status
      ? { ...item, status, reminder: getSupplementReminderCopy(status) }
      : item;
  });

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId || !name.trim()) return;
    setSubmitting(true);
    setFriendlyError(null);
    try {
      const savedTime = timeOfDay || timingSuggestion.suggestedTime;
      if (editingId) {
        await supplementsRepository.update(editingId, {
          name: name.trim(),
          dosage: doseText.trim() || null,
          timesOfDay: [savedTime],
          note: note.trim() || null,
        });
      } else {
        await supplementsRepository.create({
          userId,
          name: name.trim(),
          dosage: doseText.trim() || null,
          frequency: "daily",
          timesOfDay: [savedTime],
          active: true,
          note: note.trim() || null,
          provenance: "user_confirmed",
          userConfirmed: true,
        });
      }
      setName("");
      setDoseText("");
      setTimeOfDay("");
      setNote("");
      setEditingId(null);
      setTimeWasManuallySet(false);
      setModalOpen(false);
    } catch {
      setFriendlyError("Supplement belum bisa disimpan. Coba lagi ya 💗");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async (
    item: SupplementPlanItem,
    status: Exclude<SupplementStatus, "planned">,
  ) => {
    if (!userId) return;
    setSavingId(item.supplementId);
    setFriendlyError(null);
    setOptimisticStatuses((current) => ({
      ...current,
      [item.supplementId]: status,
    }));
    try {
      await supplementLogsRepository.setTodayStatus({
        userId,
        supplementId: item.supplementId,
        date: today,
        status,
        now: new Date().toISOString(),
        existingLogId: item.logId,
      });
    } catch {
      setOptimisticStatuses((current) => {
        const next = { ...current };
        delete next[item.supplementId];
        return next;
      });
      setFriendlyError("Status belum bisa disimpan. Coba lagi sebentar ya 💗");
    } finally {
      setSavingId(null);
    }
  };

  const handleRemove = async (supplementId: string) => {
    setSavingId(supplementId);
    setFriendlyError(null);
    try {
      await supplementsRepository.update(supplementId, { active: false });
    } catch {
      setFriendlyError("Supplement belum bisa dinonaktifkan. Coba lagi ya 💗");
    } finally {
      setSavingId(null);
    }
  };

  const loading = supplementsSource.loading || logsSource.loading;
  const sourceUnavailable = supplementsSource.error || logsSource.error;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Supplements"
        description="Pengingat ringan dari supplement yang kamu simpan sendiri."
        action={
          <Button
            leadingIcon={<Plus size={16} />}
            onClick={openCreateModal}
          >
            Tambah supplement
          </Button>
        }
      />

      {(friendlyError || sourceUnavailable) && (
        <GlassCard>
          <p role="alert" className="text-sm text-ink-muted">
            {friendlyError ?? "Data supplement belum bisa dimuat. Coba lagi sebentar ya 💗"}
          </p>
        </GlassCard>
      )}

      {loading ? (
        <div role="status" aria-label="Memuat supplement hari ini" className="grid gap-3">
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      ) : (
        <TodaySupplementPlan
          plan={plan}
          savingId={savingId}
          onStatus={handleStatus}
          onRemove={handleRemove}
          onEdit={openEditModal}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? "Ubah supplement tersimpan" : "Tambah supplement tersimpan"}
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <p className="text-xs leading-relaxed text-ink-muted">
            Simpan hanya supplement yang memang sudah kamu pilih. Aplikasi tidak
            menentukan supplement atau dosis baru.
          </p>
          <Input
            id="supplement-name"
            name="supplementName"
            label="Nama supplement"
            placeholder="Nama yang kamu simpan"
            value={name}
            onChange={(event) => {
              const nextName = event.target.value;
              setName(nextName);
              if (!timeWasManuallySet) {
                setTimeOfDay(inferSupplementSuggestedTiming(nextName).suggestedTime);
              }
            }}
            required
          />
          <Input
            id="supplement-dose"
            name="supplementDose"
            label="Dosis tersimpan (opsional)"
            placeholder="Isi persis sesuai rutinitasmu"
            value={doseText}
            onChange={(event) => setDoseText(event.target.value)}
          />
          <Input
            id="supplement-time"
            name="supplementTime"
            type="time"
            label="Waktu pengingat (opsional)"
            value={timeOfDay}
            onChange={(event) => {
              setTimeOfDay(event.target.value);
              setTimeWasManuallySet(true);
            }}
          />
          {name.trim() && (
            <div className="rounded-control border border-rose-strong/20 bg-petal-soft/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-rose-strong">
                  Saran waktu umum
                </p>
                <span className="text-[11px] font-medium text-ink-muted">
                  Bisa kamu ubah
                </span>
              </div>
              <p className="mt-1 text-sm text-ink">{timingSuggestion.copy}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {timingSuggestion.caution}
              </p>
            </div>
          )}
          <Input
            id="supplement-note"
            name="supplementNote"
            label="Catatanmu (opsional)"
            placeholder="Catatan singkat dari rutinitasmu"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="mt-2 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={closeModal}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="flex-1"
              isLoading={submitting}
              disabled={!name.trim()}
            >
              {editingId ? "Simpan perubahan" : "Simpan"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
