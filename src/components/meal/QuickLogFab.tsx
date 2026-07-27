"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { MealEntryForm, type MealFormValues } from "@/components/forms/MealEntryForm";
import { WeightEntryForm, type WeightFormValues } from "@/components/forms/WeightEntryForm";
import { QuickWaterForm } from "@/components/forms/QuickWaterForm";
import { QUICK_LOG_FOODS } from "@/lib/utils/nutritionEstimates";
import { inferMealTypeForHour } from "@/lib/utils/format";

type QuickItem =
  | { kind: "food"; key: string; emoji: string; label: string }
  | { kind: "water"; emoji: string; label: string }
  | { kind: "weight"; emoji: string; label: string };

const QUICK_ITEMS: QuickItem[] = [
  { kind: "food", key: "coffee_milk", emoji: "☕", label: "Coffee with Milk" },
  { kind: "food", key: "rice", emoji: "🍚", label: "Rice" },
  { kind: "food", key: "chicken", emoji: "🍗", label: "Chicken" },
  { kind: "food", key: "egg", emoji: "🥚", label: "Egg" },
  { kind: "food", key: "vegetables", emoji: "🥬", label: "Vegetables" },
  { kind: "food", key: "fruit", emoji: "🍎", label: "Fruit" },
  { kind: "water", emoji: "💧", label: "Water" },
  { kind: "weight", emoji: "⚖️", label: "Weight" },
];

export interface QuickLogFabProps {
  onLogFood: (values: MealFormValues) => Promise<void>;
  onLogWater: (amountMl: number) => Promise<void>;
  onLogWeight: (values: WeightFormValues) => Promise<void>;
}

/**
 * Floating "+" entry point for logging something without picking a meal
 * section first. Deliberately reuses MealEntryForm / WeightEntryForm as-is
 * (initialValues pre-filled from the nutrition estimate table, everything
 * still editable) rather than building parallel one-off forms.
 */
export function QuickLogFab({ onLogFood, onLogWater, onLogWeight }: QuickLogFabProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<QuickItem | null>(null);

  const closeAll = () => {
    setPickerOpen(false);
    setActiveItem(null);
  };

  const selectItem = (item: QuickItem) => {
    setPickerOpen(false);
    setActiveItem(item);
  };

  const foodEstimate =
    activeItem?.kind === "food" ? QUICK_LOG_FOODS.find((food) => food.key === activeItem.key) : undefined;

  return (
    <>
      <button
        onClick={() => setPickerOpen(true)}
        aria-label="Quick log"
        className="fixed bottom-24 right-5 z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-rose text-white shadow-[var(--shadow-float)] transition-transform hover:scale-105 active:scale-95 md:bottom-8"
      >
        <Plus size={26} />
      </button>

      <Modal open={pickerOpen} onClose={closeAll} title="Quick log">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => selectItem(item)}
              className="flex flex-col items-center gap-2 rounded-control bg-ink/5 px-3 py-4 text-center transition-colors hover:bg-petal-soft"
            >
              <span className="text-2xl" aria-hidden>
                {item.emoji}
              </span>
              <span className="text-xs font-medium text-ink">{item.label}</span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={activeItem?.kind === "food"} onClose={closeAll} title={`Log ${activeItem?.label ?? ""}`}>
        {activeItem?.kind === "food" && (
          <MealEntryForm
            defaultType={inferMealTypeForHour(new Date().getHours())}
            initialValues={
              foodEstimate
                ? {
                    name: foodEstimate.label,
                    isOfficeLunch: false,
                    calories: foodEstimate.macros.calories,
                    proteinG: foodEstimate.macros.proteinG,
                    carbsG: foodEstimate.macros.carbsG,
                    fatG: foodEstimate.macros.fatG,
                    fiberG: foodEstimate.macros.fiberG,
                  }
                : undefined
            }
            submitLabel="Log food"
            onSubmit={async (values) => {
              await onLogFood(values);
              closeAll();
            }}
            onCancel={closeAll}
          />
        )}
      </Modal>

      <Modal open={activeItem?.kind === "water"} onClose={closeAll} title="Log water">
        <QuickWaterForm
          onSubmit={async (amountMl) => {
            await onLogWater(amountMl);
            closeAll();
          }}
          onCancel={closeAll}
        />
      </Modal>

      <Modal open={activeItem?.kind === "weight"} onClose={closeAll} title="Log weight">
        <WeightEntryForm
          onSubmit={async (values) => {
            await onLogWeight(values);
            closeAll();
          }}
          onCancel={closeAll}
        />
      </Modal>
    </>
  );
}
