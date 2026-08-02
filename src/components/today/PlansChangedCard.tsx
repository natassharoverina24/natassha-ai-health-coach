"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import type { EmergencyAdjustmentSummary } from "@/lib/coach-plan";
import type { ActiveDisruptionSelection } from "@/lib/db/activeDisruptions.repository";
import type {
  EmergencyAffectedSlot,
  EmergencyDisruptionType,
  MealType,
} from "@/types/firestore";

const OPTIONS: readonly {
  value: EmergencyDisruptionType;
  label: string;
}[] = [
  { value: "working-late", label: "Kerja sampai malam" },
  { value: "migraine", label: "Migraine" },
  { value: "feeling-unwell", label: "Lagi kurang enak badan" },
  { value: "pms", label: "PMS" },
  { value: "travelling", label: "Sedang bepergian" },
  { value: "event-or-reception", label: "Ada acara atau resepsi" },
  { value: "missed-workout", label: "Workout terlewat" },
  { value: "skipped-meal", label: "Makan terlewat" },
];

const SELECT_CLASS =
  "h-12 w-full rounded-control border border-ink/10 bg-bg-elevated px-4 text-sm text-ink focus:border-rose";

export function PlansChangedCard({
  adjustment,
  saving,
  error,
  onSave,
  onClear,
}: {
  adjustment: EmergencyAdjustmentSummary | null;
  saving: boolean;
  error: string | null;
  onSave: (selection: ActiveDisruptionSelection) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [type, setType] = useState<EmergencyDisruptionType | "">("");
  const [expectedEndAt, setExpectedEndAt] = useState("");
  const [affectedSlot, setAffectedSlot] =
    useState<EmergencyAffectedSlot | "">("");
  const [affectedMealSlot, setAffectedMealSlot] =
    useState<"lunch" | "dinner" | "snack" | "">("");
  const [skippedMealSlot, setSkippedMealSlot] =
    useState<MealType | "">("");
  const [skippedAt, setSkippedAt] = useState("");

  const selection = buildSelection({
    type,
    expectedEndAt,
    affectedSlot,
    affectedMealSlot,
    skippedMealSlot,
    skippedAt,
  });

  return (
    <GlassCard>
      <section id="plans-changed" className="scroll-mt-24" aria-labelledby="plans-changed-heading">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 text-rose-strong" aria-hidden />
          <div>
            <h2 id="plans-changed-heading" className="font-bold text-ink">
              Plan berubah?
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Ceritain yang berubah. Targetmu nggak akan dijadikan hukuman kok.
            </p>
          </div>
        </div>

        {adjustment && (
          <div className="mt-4 rounded-control bg-petal-soft p-4">
            <p className="font-semibold text-ink">
              Nggak perlu merasa bersalah. Plan hari ini sudah disesuaikan 💗
            </p>
            <p className="mt-1 text-sm text-ink-muted">{adjustment.message}</p>
            <p className="mt-1 text-sm text-ink-muted">
              Kita tetap bikin semuanya lembut dan praktis.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={saving}
              onClick={() => void onClear()}
              aria-label="Undo adjustment"
            >
              Batalkan penyesuaian
            </Button>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Apa yang berubah?
            <select
              id="emergency-disruption-type"
              name="emergencyDisruptionType"
              aria-label="What changed?"
              className={SELECT_CLASS}
              value={type}
              onChange={(event) =>
                setType(event.target.value as EmergencyDisruptionType | "")
              }
            >
              <option value="">Pilih satu</option>
              {OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {type === "working-late" && (
            <Input
              id="emergency-expected-end-at"
              name="emergencyExpectedEndAt"
              label="Perkiraan selesai"
              aria-label="Expected finish time"
              type="time"
              value={expectedEndAt}
              onChange={(event) => setExpectedEndAt(event.target.value)}
              required
            />
          )}
          {type === "travelling" && (
            <SlotSelect
              id="emergency-affected-slot"
              name="emergencyAffectedSlot"
              label="Bagian yang terdampak"
              ariaLabel="Affected slot"
              value={affectedSlot}
              options={["breakfast", "lunch", "snack", "dinner", "workout"]}
              onChange={(value) =>
                setAffectedSlot(value as EmergencyAffectedSlot)
              }
            />
          )}
          {type === "event-or-reception" && (
            <SlotSelect
              id="emergency-affected-meal-slot"
              name="emergencyAffectedMealSlot"
              label="Waktu makan yang terdampak"
              ariaLabel="Affected meal"
              value={affectedMealSlot}
              options={["lunch", "dinner", "snack"]}
              onChange={(value) =>
                setAffectedMealSlot(value as "lunch" | "dinner" | "snack")
              }
            />
          )}
          {type === "skipped-meal" && (
            <>
              <SlotSelect
                id="emergency-skipped-meal-slot"
                name="emergencySkippedMealSlot"
                label="Waktu makan yang terlewat"
                ariaLabel="Skipped meal"
                value={skippedMealSlot}
                options={["breakfast", "lunch", "snack", "dinner"]}
                onChange={(value) => setSkippedMealSlot(value as MealType)}
              />
              <Input
                id="emergency-skipped-at"
                name="emergencySkippedAt"
                label="Waktu terlewat"
                aria-label="Time skipped"
                type="time"
                value={skippedAt}
                onChange={(event) => setSkippedAt(event.target.value)}
                required
              />
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Button
          type="button"
          className="mt-4"
          isLoading={saving}
          disabled={!selection}
          onClick={() => selection && void onSave(selection)}
          aria-label="Adjust today's plan"
        >
          Sesuaikan plan hari ini
        </Button>
      </section>
    </GlassCard>
  );
}

function SlotSelect({
  id,
  name,
  label,
  ariaLabel,
  value,
  options,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  ariaLabel?: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex flex-col gap-1.5 text-sm font-medium text-ink"
    >
      {label}
      <select
        id={id}
        name={name}
        aria-label={ariaLabel ?? label}
        className={SELECT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      >
        <option value="">Pilih satu</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("-", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildSelection({
  type,
  expectedEndAt,
  affectedSlot,
  affectedMealSlot,
  skippedMealSlot,
  skippedAt,
}: {
  type: EmergencyDisruptionType | "";
  expectedEndAt: string;
  affectedSlot: EmergencyAffectedSlot | "";
  affectedMealSlot: "lunch" | "dinner" | "snack" | "";
  skippedMealSlot: MealType | "";
  skippedAt: string;
}): ActiveDisruptionSelection | null {
  if (type === "working-late") {
    return expectedEndAt ? { type, expectedEndAt } : null;
  }
  if (type === "travelling") {
    return affectedSlot ? { type, affectedSlot } : null;
  }
  if (type === "event-or-reception") {
    return affectedMealSlot ? { type, affectedMealSlot } : null;
  }
  if (type === "skipped-meal") {
    return skippedMealSlot && skippedAt
      ? { type, skippedMealSlot, skippedAt }
      : null;
  }
  return type ? { type } : null;
}
