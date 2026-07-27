"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { MealType } from "@/types/firestore";

export interface MealFormValues {
  type: MealType;
  name: string;
  quantity: string | null;
  isOfficeLunch: boolean;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  note: string | null;
}

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

export interface MealEntryFormProps {
  defaultType?: MealType;
  initialValues?: Partial<MealFormValues>;
  submitLabel?: string;
  onSubmit: (values: MealFormValues) => Promise<void>;
  onCancel: () => void;
}

export function MealEntryForm({
  defaultType = "lunch",
  initialValues,
  submitLabel = "Save meal",
  onSubmit,
  onCancel,
}: MealEntryFormProps) {
  const [type, setType] = useState<MealType>(initialValues?.type ?? defaultType);
  const [name, setName] = useState(initialValues?.name ?? "");
  const [quantity, setQuantity] = useState(initialValues?.quantity ?? "");
  const [isOfficeLunch, setIsOfficeLunch] = useState(
    initialValues?.isOfficeLunch ?? defaultType === "lunch",
  );
  const [calories, setCalories] = useState(initialValues?.calories?.toString() ?? "");
  const [protein, setProtein] = useState(initialValues?.proteinG?.toString() ?? "");
  const [carbs, setCarbs] = useState(initialValues?.carbsG?.toString() ?? "");
  const [fat, setFat] = useState(initialValues?.fatG?.toString() ?? "");
  const [fiber, setFiber] = useState(initialValues?.fiberG?.toString() ?? "");
  const [note, setNote] = useState(initialValues?.note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give this food a name.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        type,
        name: name.trim(),
        quantity: quantity.trim() || null,
        isOfficeLunch,
        calories: parseFloat(calories) || 0,
        proteinG: parseFloat(protein) || 0,
        carbsG: parseFloat(carbs) || 0,
        fatG: parseFloat(fat) || 0,
        fiberG: fiber ? parseFloat(fiber) : null,
        note: note || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save meal.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">Meal type</label>
        <div className="flex flex-wrap gap-2">
          {MEAL_TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setType(option.value);
                setIsOfficeLunch(option.value === "lunch");
              }}
              className={
                type === option.value
                  ? "rounded-pill bg-rose px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-pill bg-ink/5 px-4 py-2 text-sm font-medium text-ink-muted"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          name="mealName"
          label="Food name"
          placeholder="e.g. Grilled chicken"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          name="mealQuantity"
          label="Quantity (optional)"
          placeholder="e.g. 1 plate, 200g"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>

      {type === "lunch" && (
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={isOfficeLunch}
            onChange={(e) => setIsOfficeLunch(e.target.checked)}
            className="h-4 w-4 rounded accent-[var(--color-rose)]"
          />
          This is the office-provided lunch
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input name="mealCalories" type="number" inputMode="decimal" label="Calories" suffix="kcal" value={calories} onChange={(e) => setCalories(e.target.value)} />
        <Input name="mealProtein" type="number" inputMode="decimal" label="Protein" suffix="g" value={protein} onChange={(e) => setProtein(e.target.value)} />
        <Input name="mealCarbs" type="number" inputMode="decimal" label="Carbs" suffix="g" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        <Input name="mealFat" type="number" inputMode="decimal" label="Fat" suffix="g" value={fat} onChange={(e) => setFat(e.target.value)} />
        <Input name="mealFiber" type="number" inputMode="decimal" label="Fiber" suffix="g" value={fiber} onChange={(e) => setFiber(e.target.value)} />
      </div>

      <Input name="mealNote" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

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
