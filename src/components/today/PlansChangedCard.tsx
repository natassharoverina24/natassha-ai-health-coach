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
  { value: "working-late", label: "Working late" },
  { value: "migraine", label: "Migraine" },
  { value: "feeling-unwell", label: "Feeling unwell" },
  { value: "pms", label: "PMS" },
  { value: "travelling", label: "Travelling" },
  { value: "event-or-reception", label: "Event or reception" },
  { value: "missed-workout", label: "Missed workout" },
  { value: "skipped-meal", label: "Skipped meal" },
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
      <section aria-labelledby="plans-changed-heading">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 text-rose-strong" aria-hidden />
          <div>
            <h2 id="plans-changed-heading" className="font-bold text-ink">
              Plans changed?
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Tell the coach what changed. Your targets are not being punished.
            </p>
          </div>
        </div>

        {adjustment && (
          <div className="mt-4 rounded-control bg-teal-soft p-4">
            <p className="font-semibold text-ink">
              No guilt. We adjusted today&apos;s plan.
            </p>
            <p className="mt-1 text-sm text-ink-muted">{adjustment.message}</p>
            <p className="mt-1 text-sm text-ink-muted">
              We&apos;ll keep this gentle and practical.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={saving}
              onClick={() => void onClear()}
            >
              Undo adjustment
            </Button>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            What changed?
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
              <option value="">Choose one</option>
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
              label="Expected finish time"
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
              label="Affected slot"
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
              label="Affected meal"
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
                label="Skipped meal"
                value={skippedMealSlot}
                options={["breakfast", "lunch", "snack", "dinner"]}
                onChange={(value) => setSkippedMealSlot(value as MealType)}
              />
              <Input
                id="emergency-skipped-at"
                name="emergencySkippedAt"
                label="Time skipped"
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
        >
          Adjust today&apos;s plan
        </Button>
      </section>
    </GlassCard>
  );
}

function SlotSelect({
  id,
  name,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
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
        aria-label={label}
        className={SELECT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      >
        <option value="">Choose one</option>
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
