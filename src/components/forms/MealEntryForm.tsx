"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type {
  MealNutritionConfirmation,
  MealType,
} from "@/types/firestore";
import type {
  ManualNutritionEstimateRequest,
  ManualNutritionEstimateResult,
  NutritionEstimateConfidence,
} from "@/lib/ai/manualNutritionEstimate";
import { findApprovedNutritionEstimate } from "@/lib/ai/manualNutritionEstimate";
import { buildNutritionEstimateMetadata } from "@/lib/ai/nutritionEstimateMetadata";

export interface MealFormValues {
  clientRequestId?: string;
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
  nutritionConfirmation?: MealNutritionConfirmation;
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
  onEstimate?: (
    request: ManualNutritionEstimateRequest,
  ) => Promise<ManualNutritionEstimateResult>;
}

export function MealEntryForm({
  defaultType = "lunch",
  initialValues,
  submitLabel = "Save meal",
  onSubmit,
  onCancel,
  onEstimate,
}: MealEntryFormProps) {
  const isEditing = initialValues !== undefined;
  const initialNutritionIsValid =
    typeof initialValues?.calories === "number" &&
    Number.isFinite(initialValues.calories) &&
    initialValues.calories > 0 &&
    [initialValues.proteinG, initialValues.carbsG, initialValues.fatG].every(
      (value) =>
        typeof value === "number" && Number.isFinite(value) && value >= 0,
    ) &&
    (initialValues.nutritionConfirmation === undefined ||
      (initialValues.nutritionConfirmation.status === "confirmed" &&
        initialValues.nutritionConfirmation.userConfirmed === true));
  const requiresExplicitConfirmation = isEditing && !initialNutritionIsValid;
  const [initialLocalEstimate] = useState(() =>
    requiresExplicitConfirmation && initialValues?.name
      ? findApprovedNutritionEstimate({
          name: initialValues.name,
          quantity: initialValues.quantity ?? null,
        })
      : null,
  );
  const [type, setType] = useState<MealType>(initialValues?.type ?? defaultType);
  const [clientRequestId] = useState(
    () =>
      initialValues?.clientRequestId ??
      `manual-meal-${
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`
      }`,
  );
  const [name, setName] = useState(initialValues?.name ?? "");
  const [quantity, setQuantity] = useState(initialValues?.quantity ?? "");
  const [isOfficeLunch, setIsOfficeLunch] = useState(
    initialValues?.isOfficeLunch ?? defaultType === "lunch",
  );
  const [calories, setCalories] = useState(
    initialLocalEstimate?.macros.calories.toString() ??
      initialValues?.calories?.toString() ??
      "",
  );
  const [protein, setProtein] = useState(
    initialLocalEstimate?.macros.proteinG.toString() ??
      initialValues?.proteinG?.toString() ??
      "",
  );
  const [carbs, setCarbs] = useState(
    initialLocalEstimate?.macros.carbsG.toString() ??
      initialValues?.carbsG?.toString() ??
      "",
  );
  const [fat, setFat] = useState(
    initialLocalEstimate?.macros.fatG.toString() ??
      initialValues?.fatG?.toString() ??
      "",
  );
  const [fiber, setFiber] = useState(
    initialLocalEstimate?.macros.fiberG?.toString() ??
      initialValues?.fiberG?.toString() ??
      "",
  );
  const [servingGrams, setServingGrams] = useState(
    initialLocalEstimate?.servingGrams?.toString() ??
      initialValues?.nutritionConfirmation?.servingGrams?.toString() ??
      "",
  );
  const [note, setNote] = useState(initialValues?.note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimateStatus, setEstimateStatus] = useState<
    "unresolved" | "estimating" | "review" | "manual"
  >(
    initialLocalEstimate
      ? "review"
      : onEstimate && (!isEditing || requiresExplicitConfirmation)
        ? "unresolved"
        : "review",
  );
  const [estimateSource, setEstimateSource] =
    useState<MealNutritionConfirmation["source"]>(
      initialLocalEstimate?.source ??
        initialValues?.nutritionConfirmation?.source ??
        "manual-entry",
    );
  const [estimateProvider, setEstimateProvider] = useState(
    initialLocalEstimate?.provider ??
      initialValues?.nutritionConfirmation?.provider ??
      null,
  );
  const [estimateModel, setEstimateModel] = useState(
    initialLocalEstimate?.model ??
      initialValues?.nutritionConfirmation?.model ??
      null,
  );
  const [estimateAssumptions, setEstimateAssumptions] = useState<string[]>(
    initialLocalEstimate?.assumptions ??
      initialValues?.nutritionConfirmation?.assumptions ??
      [],
  );
  const [estimatedAt, setEstimatedAt] = useState<string | null>(
    initialLocalEstimate?.estimatedAt ??
      initialValues?.nutritionConfirmation?.estimatedAt ??
      null,
  );
  const [estimateConfidence, setEstimateConfidence] =
    useState<NutritionEstimateConfidence | null>(
      initialLocalEstimate?.confidence ?? null,
    );
  const [estimateUncertain, setEstimateUncertain] = useState(
    initialLocalEstimate?.uncertain ?? false,
  );
  const [estimateMetadata, setEstimateMetadata] = useState(
    initialLocalEstimate?.metadata ??
      buildNutritionEstimateMetadata({
        source:
          initialValues?.nutritionConfirmation?.source ?? "manual-entry",
        model: initialValues?.nutritionConfirmation?.model ?? null,
        estimatedAt:
          initialValues?.nutritionConfirmation?.estimatedAt ?? null,
        confidence:
          initialValues?.nutritionConfirmation?.estimateMetadata
            ?.confidence ?? null,
      }),
  );
  const [nutritionConfirmed, setNutritionConfirmed] = useState(
    !requiresExplicitConfirmation,
  );

  const clearEstimateForChangedFood = () => {
    if (!onEstimate || estimateStatus === "unresolved") return;
    setEstimateStatus("unresolved");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setFiber("");
    setServingGrams("");
    setEstimateAssumptions([]);
    setEstimateProvider(null);
    setEstimateModel(null);
    setEstimatedAt(null);
    setEstimateConfidence(null);
    setEstimateUncertain(false);
    setEstimateMetadata(
      buildNutritionEstimateMetadata({ source: "manual-entry" }),
    );
    setNutritionConfirmed(false);
  };

  const parsedRequiredMacro = (value: string): number | null => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const parsedCalories = parsedRequiredMacro(calories);
  const parsedProtein = parsedRequiredMacro(protein);
  const parsedCarbs = parsedRequiredMacro(carbs);
  const parsedFat = parsedRequiredMacro(fat);
  const nutritionValuesAreValid =
    parsedCalories !== null &&
    parsedCalories > 0 &&
    parsedProtein !== null &&
    parsedCarbs !== null &&
    parsedFat !== null &&
    parsedCalories + parsedProtein + parsedCarbs + parsedFat > 0;

  const applyEstimate = (
    estimate: Extract<
      ManualNutritionEstimateResult,
      { status: "ready" }
    >["estimate"],
  ) => {
    setCalories(String(estimate.macros.calories));
    setProtein(String(estimate.macros.proteinG));
    setCarbs(String(estimate.macros.carbsG));
    setFat(String(estimate.macros.fatG));
    setFiber(
      estimate.macros.fiberG === null ||
        estimate.macros.fiberG === undefined
        ? ""
        : String(estimate.macros.fiberG),
    );
    setServingGrams(
      estimate.servingGrams === null ? "" : String(estimate.servingGrams),
    );
    setEstimateSource(estimate.source);
    setEstimateProvider(estimate.provider);
    setEstimateModel(estimate.model);
    setEstimateAssumptions([...estimate.assumptions]);
    setEstimatedAt(estimate.estimatedAt);
    setEstimateConfidence(estimate.confidence);
    setEstimateUncertain(estimate.uncertain);
    setEstimateMetadata(
      buildNutritionEstimateMetadata({
        source: estimate.source,
        model: estimate.model,
        estimatedAt: estimate.estimatedAt,
        confidence: estimate.confidence,
      }),
    );
    setEstimateStatus("review");
    setNutritionConfirmed(false);
  };

  const handleEstimate = async () => {
    if (!name.trim()) {
      setError("Give this food a name.");
      return;
    }
    if (!onEstimate) return;

    setSubmitting(true);
    setError(null);
    setEstimateStatus("estimating");
    try {
      const result = await onEstimate({
        name: name.trim(),
        quantity: quantity.trim() || null,
      });
      if (result.status === "unavailable") {
        setEstimateStatus("manual");
        setEstimateSource("manual-entry");
        setEstimateProvider(null);
        setEstimateModel(null);
        setEstimateMetadata(
          buildNutritionEstimateMetadata({ source: "manual-entry" }),
        );
        setError("Nutrition estimate unavailable");
        return;
      }
      applyEstimate(result.estimate);
    } catch {
      setEstimateStatus("manual");
      setEstimateSource("manual-entry");
      setEstimateProvider(null);
      setEstimateModel(null);
      setEstimateMetadata(
        buildNutritionEstimateMetadata({ source: "manual-entry" }),
      );
      setError("Nutrition estimate unavailable");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give this food a name.");
      return;
    }
    if (!nutritionValuesAreValid) {
      setError(
        "Confirm calories, protein, carbs, and fat before saving. Calories must be greater than zero.",
      );
      return;
    }
    if (requiresExplicitConfirmation && !nutritionConfirmed) {
      setError("Confirm the nutrition values before saving changes.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (
        parsedCalories === null ||
        parsedCalories <= 0 ||
        parsedProtein === null ||
        parsedCarbs === null ||
        parsedFat === null
      ) {
        setError(
          "Confirm calories, protein, carbs, and fat before saving. Calories must be greater than zero.",
        );
        return;
      }
      const parsedGrams = servingGrams.trim()
        ? Number(servingGrams)
        : null;
      if (
        parsedGrams !== null &&
        (!Number.isFinite(parsedGrams) || parsedGrams <= 0)
      ) {
        setError("Serving grams must be greater than zero.");
        return;
      }
      const confirmedAt = new Date().toISOString();
      await onSubmit({
        clientRequestId,
        type,
        name: name.trim(),
        quantity: quantity.trim() || null,
        isOfficeLunch,
        calories: parsedCalories,
        proteinG: parsedProtein,
        carbsG: parsedCarbs,
        fatG: parsedFat,
        fiberG: fiber.trim() ? parsedRequiredMacro(fiber) : null,
        note: note || null,
        nutritionConfirmation: onEstimate
          ? {
              status: "confirmed",
              source: estimateSource,
              userConfirmed: true,
              servingGrams: parsedGrams,
              assumptions: [...estimateAssumptions],
              estimatedAt,
              confirmedAt,
              provider: estimateProvider,
              model: estimateModel,
              estimateMetadata: {
                ...estimateMetadata,
                model: estimateModel,
                estimatedAt,
                confidence: estimateConfidence,
              },
            }
          : initialValues?.nutritionConfirmation,
      });
    } catch {
      setError("Failed to save meal. Please try again.");
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
                  ? "rounded-pill bg-rose-strong px-4 py-2 text-sm font-semibold text-white"
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
          onChange={(e) => {
            setName(e.target.value);
            clearEstimateForChangedFood();
          }}
          required
        />
        <Input
          name="mealQuantity"
          label="Quantity (optional)"
          placeholder="e.g. 1 plate, 200g"
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value);
            clearEstimateForChangedFood();
          }}
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
        <Input
          name="mealServingGrams"
          type="number"
          inputMode="decimal"
          label="Serving grams (optional)"
          suffix="g"
          value={servingGrams}
          onChange={(e) => {
            setServingGrams(e.target.value);
            setNutritionConfirmed(false);
          }}
        />
        <Input name="mealCalories" type="number" inputMode="decimal" label="Calories" suffix="kcal" value={calories} onChange={(e) => {
          setCalories(e.target.value);
          setNutritionConfirmed(false);
        }} />
        <Input name="mealProtein" type="number" inputMode="decimal" label="Protein" suffix="g" value={protein} onChange={(e) => {
          setProtein(e.target.value);
          setNutritionConfirmed(false);
        }} />
        <Input name="mealCarbs" type="number" inputMode="decimal" label="Carbs" suffix="g" value={carbs} onChange={(e) => {
          setCarbs(e.target.value);
          setNutritionConfirmed(false);
        }} />
        <Input name="mealFat" type="number" inputMode="decimal" label="Fat" suffix="g" value={fat} onChange={(e) => {
          setFat(e.target.value);
          setNutritionConfirmed(false);
        }} />
        <Input name="mealFiber" type="number" inputMode="decimal" label="Fiber" suffix="g" value={fiber} onChange={(e) => setFiber(e.target.value)} />
      </div>

      {onEstimate && estimateStatus === "unresolved" && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleEstimate}
            isLoading={submitting}
          >
            {isEditing ? "Estimate with AI" : "Estimate nutrition"}
          </Button>
          {isEditing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEstimateStatus("manual");
                setEstimateSource("manual-entry");
                setEstimateProvider(null);
                setEstimateModel(null);
                setEstimateMetadata(
                  buildNutritionEstimateMetadata({
                    source: "manual-entry",
                  }),
                );
                setError(null);
              }}
            >
              Enter nutrition manually
            </Button>
          )}
        </div>
      )}

      {estimateStatus === "estimating" && (
        <p role="status" className="text-sm text-ink-muted">
          Checking approved nutrition data…
        </p>
      )}
      {(estimateStatus === "review" || estimateStatus === "manual") &&
        onEstimate && (
          <div className="rounded-control bg-taupe-soft px-3 py-2 text-sm text-ink">
            <p className="font-semibold">
              Review and confirm nutrition before this food enters the meal
              total.
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {estimateMetadata.providerLabel}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {estimateStatus === "manual"
                ? "Manual nutrition entry"
                : estimateSource === "user-confirmed-cache"
                  ? "Previously confirmed nutrition"
                  : estimateUncertain
                    ? `AI estimate: ${estimateConfidence ?? "low"} confidence · uncertain`
                    : "Approved local nutrition"}
            </p>
            {estimateAssumptions.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs text-ink-muted">
                {estimateAssumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            )}
          </div>
        )}

      {requiresExplicitConfirmation &&
        !nutritionConfirmed &&
        (estimateStatus === "review" || estimateStatus === "manual") && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!nutritionValuesAreValid}
            onClick={() => {
              setNutritionConfirmed(true);
              setError(null);
            }}
          >
            Confirm nutrition
          </Button>
        )}

      <Input name="mealNote" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="mt-2 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1"
          isLoading={submitting}
          disabled={
            !nutritionValuesAreValid ||
            estimateStatus === "estimating" ||
            (requiresExplicitConfirmation && !nutritionConfirmed)
          }
        >
          {onEstimate && !isEditing
            ? `Confirm and ${submitLabel.toLowerCase()}`
            : submitLabel}
        </Button>
      </div>
    </form>
  );
}
