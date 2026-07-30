import { Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";

import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCalories, formatGrams } from "@/lib/utils/format";
import {
  hasConfirmedMealNutrition,
  sumMacros,
} from "@/lib/utils/nutritionEstimates";
import type { MealEntry, MealType } from "@/types/firestore";

export interface MealTypeSectionProps {
  type: MealType;
  label: string;
  items: MealEntry[];
  onAddFood: () => void;
  onAddOfficeLunch?: () => void;
  onView: (meal: MealEntry) => void;
  onEdit: (meal: MealEntry) => void;
  onDelete: (id: string) => void;
}

export function MealTypeSection({
  type,
  label,
  items,
  onAddFood,
  onAddOfficeLunch,
  onView,
  onEdit,
  onDelete,
}: MealTypeSectionProps) {
  const confirmedItems = items.filter(hasConfirmedMealNutrition);
  const unresolvedCount = items.length - confirmedItems.length;
  const subtotal = sumMacros(confirmedItems.map((item) => item.macros));

  return (
    <GlassCard padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
          {items.length > 0 && (
            <>
              <p className="mt-0.5 text-xs text-ink-faint">
                {formatCalories(subtotal.calories)} · P {formatGrams(subtotal.proteinG)} · C{" "}
                {formatGrams(subtotal.carbsG)} · F {formatGrams(subtotal.fatG)}
                {subtotal.fiberG ? ` · Fiber ${formatGrams(subtotal.fiberG)}` : ""}
              </p>
              {unresolvedCount > 0 && (
                <p className="mt-1 text-xs font-medium text-amber">
                  {unresolvedCount} item needs confirmed nutrition and is not
                  included in this total.
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {type === "lunch" && onAddOfficeLunch && (
            <Button size="sm" variant="secondary" onClick={onAddOfficeLunch}>
              Office lunch
            </Button>
          )}
          <Button size="sm" variant="ghost" leadingIcon={<Plus size={14} />} onClick={onAddFood}>
            Add food
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-2 pb-4 pt-2">
          <EmptyState
            icon={<UtensilsCrossed size={22} />}
            title={`Nothing logged for ${label.toLowerCase()} yet`}
          />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-ink/8">
          {items.map((meal) => {
            const nutritionConfirmed = hasConfirmedMealNutrition(meal);
            return (
            <li key={meal.id} className="flex items-center justify-between gap-3 px-5 py-4">
              <button
                type="button"
                onClick={() => onView(meal)}
                className="flex-1 text-left"
                aria-label={`View ${meal.name}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{meal.name}</p>
                  {meal.quantity && <span className="text-xs text-ink-muted">· {meal.quantity}</span>}
                  {meal.isOfficeLunch && <Badge tone="rose">Office lunch</Badge>}
                </div>
                {nutritionConfirmed ? (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {formatCalories(meal.macros.calories)} · P {formatGrams(meal.macros.proteinG)} · C{" "}
                    {formatGrams(meal.macros.carbsG)} · F {formatGrams(meal.macros.fatG)}
                    {meal.macros.fiberG ? ` · Fiber ${formatGrams(meal.macros.fiberG)}` : ""}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs font-medium text-amber">
                    Nutrition unresolved · excluded from total
                  </p>
                )}
                {meal.note && <p className="mt-0.5 text-xs text-ink-faint">{meal.note}</p>}
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(meal)}
                  aria-label={`Edit ${meal.name}`}
                  className="rounded-full p-2 text-ink-faint transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => onDelete(meal.id)}
                  aria-label={`Delete ${meal.name}`}
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
  );
}
