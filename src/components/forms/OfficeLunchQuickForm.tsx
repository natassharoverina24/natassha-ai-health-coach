"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { OFFICE_LUNCH_ITEMS, sumMacros } from "@/lib/utils/nutritionEstimates";
import type { MealMacro } from "@/types/firestore";

export interface OfficeLunchFormValues {
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
}

export interface OfficeLunchQuickFormProps {
  onSubmit: (values: OfficeLunchFormValues) => Promise<void>;
  onCancel: () => void;
}

/**
 * "Quick input mode" for the office-provided lunch: select every item on
 * today's tray, get a summed nutrition estimate instantly, then adjust the
 * numbers by hand before saving — matches how an office lunch actually
 * varies day to day (extra rice, no soup, etc.) without typing macros from
 * scratch every time.
 */
export function OfficeLunchQuickForm({ onSubmit, onCancel }: OfficeLunchQuickFormProps) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [editedMacros, setEditedMacros] = useState<MealMacro | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItems = OFFICE_LUNCH_ITEMS.filter((item) => selectedKeys.includes(item.key));
  const estimatedMacros = useMemo(
    () => sumMacros(selectedItems.map((item) => item.macros)),
    [selectedItems],
  );
  const macros = editedMacros ?? estimatedMacros;

  const toggleItem = (key: string) => {
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    // Selecting/deselecting a different combination invalidates any hand
    // edit made against the previous combination's estimate.
    setEditedMacros(null);
  };

  const updateMacro = (field: keyof MealMacro, value: string) => {
    const parsed = value === "" ? (field === "fiberG" ? null : 0) : parseFloat(value);
    setEditedMacros({ ...macros, [field]: parsed });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      setError("Select at least one item from today's lunch.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: selectedItems.map((item) => item.label).join(", "),
        calories: macros.calories,
        proteinG: macros.proteinG,
        carbsG: macros.carbsG,
        fatG: macros.fatG,
        fiberG: macros.fiberG,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save office lunch.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">What&apos;s on today&apos;s tray?</label>
        <div className="flex flex-wrap gap-2">
          {OFFICE_LUNCH_ITEMS.map((item) => {
            const selected = selectedKeys.includes(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleItem(item.key)}
                aria-pressed={selected}
                className={
                  selected
                    ? "flex items-center gap-1.5 rounded-pill bg-rose-strong px-3.5 py-2 text-sm font-semibold text-white"
                    : "flex items-center gap-1.5 rounded-pill bg-ink/5 px-3.5 py-2 text-sm font-medium text-ink-muted"
                }
              >
                {selected && <Check size={14} />}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {selectedItems.length > 0 && (
        <>
          <p className="text-xs text-ink-muted">
            Estimated from {selectedItems.map((item) => item.serving.toLowerCase()).join(" + ")}. Adjust
            anything below if today&apos;s portions were different.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="officeLunchCalories"
              type="number"
              inputMode="decimal"
              label="Calories"
              suffix="kcal"
              value={macros.calories.toString()}
              onChange={(e) => updateMacro("calories", e.target.value)}
            />
            <Input
              name="officeLunchProtein"
              type="number"
              inputMode="decimal"
              label="Protein"
              suffix="g"
              value={macros.proteinG.toString()}
              onChange={(e) => updateMacro("proteinG", e.target.value)}
            />
            <Input
              name="officeLunchCarbs"
              type="number"
              inputMode="decimal"
              label="Carbs"
              suffix="g"
              value={macros.carbsG.toString()}
              onChange={(e) => updateMacro("carbsG", e.target.value)}
            />
            <Input
              name="officeLunchFat"
              type="number"
              inputMode="decimal"
              label="Fat"
              suffix="g"
              value={macros.fatG.toString()}
              onChange={(e) => updateMacro("fatG", e.target.value)}
            />
            <Input
              name="officeLunchFiber"
              type="number"
              inputMode="decimal"
              label="Fiber"
              suffix="g"
              value={(macros.fiberG ?? 0).toString()}
              onChange={(e) => updateMacro("fiberG", e.target.value)}
            />
          </div>
        </>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="mt-2 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" isLoading={submitting} disabled={selectedItems.length === 0}>
          Save lunch
        </Button>
      </div>
    </form>
  );
}
