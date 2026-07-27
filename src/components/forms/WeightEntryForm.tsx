"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { todayISODate } from "@/lib/utils/format";

export interface WeightFormValues {
  date: string;
  weightKg: number;
  bodyFatPercent: number | null;
  note: string | null;
}

export interface WeightEntryFormProps {
  initialValues?: Partial<WeightFormValues>;
  onSubmit: (values: WeightFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function WeightEntryForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = "Save entry",
}: WeightEntryFormProps) {
  const [date, setDate] = useState(initialValues?.date ?? todayISODate());
  const [weightKg, setWeightKg] = useState(initialValues?.weightKg?.toString() ?? "");
  const [bodyFat, setBodyFat] = useState(initialValues?.bodyFatPercent?.toString() ?? "");
  const [note, setNote] = useState(initialValues?.note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsedWeight = parseFloat(weightKg);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setError("Enter a valid weight in kg.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        date,
        weightKg: parsedWeight,
        bodyFatPercent: bodyFat ? parseFloat(bodyFat) : null,
        note: note || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        type="date"
        label="Date"
        value={date}
        max={todayISODate()}
        onChange={(e) => setDate(e.target.value)}
        required
      />
      <Input
        type="number"
        inputMode="decimal"
        step="0.1"
        label="Weight"
        placeholder="e.g. 70.5"
        suffix="kg"
        value={weightKg}
        onChange={(e) => setWeightKg(e.target.value)}
        required
      />
      <Input
        type="number"
        inputMode="decimal"
        step="0.1"
        label="Body fat (optional)"
        placeholder="e.g. 28.0"
        suffix="%"
        value={bodyFat}
        onChange={(e) => setBodyFat(e.target.value)}
      />
      <Input
        label="Note (optional)"
        placeholder="How are you feeling?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="mt-2 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" isLoading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
