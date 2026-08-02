"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils/cn";
import {
  buildBatchCookingOpportunities,
  type ShoppingListCategory,
  type ShoppingListResult,
} from "@/lib/shopping-list";

const CATEGORY_LABELS: Readonly<Record<ShoppingListCategory, string>> = {
  protein: "Protein",
  carbohydrate: "Karbo",
  "vegetable-fiber": "Sayur / Fiber",
  "fruit-snack": "Buah / Snack",
  drink: "Minuman",
  "pantry-basic": "Pantry / Basic",
};

const CATEGORY_ORDER: readonly ShoppingListCategory[] = [
  "protein",
  "carbohydrate",
  "vegetable-fiber",
  "fruit-snack",
  "drink",
  "pantry-basic",
];

export function AutoShoppingList({ result }: { result: ShoppingListResult }) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  if (result.status === "empty") {
    return (
      <GlassCard>
        <EmptyState
          icon={<ShoppingCart size={28} />}
          title="Daftar belanja belum tersedia"
          description="Belum ada meal plan mingguan, jadi daftar belanja belum bisa dibuat."
        />
      </GlassCard>
    );
  }

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: result.items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);
  const batchOpportunities = buildBatchCookingOpportunities(result.items);

  const toggle = (id: string) => {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <GlassCard className="bg-petal-soft/60">
        <p className="text-sm font-semibold text-ink">
          Daftar belanja dibuat dari meal plan mingguanmu 💗
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Beberapa jumlah masih estimasi ya, nanti bisa kamu sesuaikan pas belanja.
        </p>
        {result.status === "partial" && (
          <p role="status" className="mt-2 text-xs font-medium text-rose-strong">
            Beberapa item masih perlu dicek manual.
          </p>
        )}
      </GlassCard>

      {grouped.map((group) => (
        <GlassCard key={group.category} padding="none" className="overflow-hidden">
          <h2 className="px-4 pt-4 text-sm font-semibold text-rose-strong sm:px-5">
            {CATEGORY_LABELS[group.category]}
          </h2>
          <ul className="mt-2 divide-y divide-ink/8">
            {group.items.map((item) => {
              const checked = checkedIds.has(item.id);
              return (
                <li key={`${item.id}:${item.unit ?? "manual"}`} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(item.id)}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[var(--color-rose)]"
                    aria-label={`Tandai ${item.name} sudah dibeli`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className={cn("text-sm font-semibold text-ink", checked && "text-ink-faint line-through")}>
                        {item.name}
                      </p>
                      <p className="text-xs font-medium text-ink-muted">
                        {item.estimatedQuantity === null
                          ? "Cek manual"
                          : `~${item.estimatedQuantity} ${item.unit}`}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      {item.quantityStatus === "estimated"
                        ? "Estimasi · sesuaikan porsi"
                        : "Butuh konfirmasi"}
                      {" · "}
                      {item.sourceLabel}
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">
                      Dari {item.sourceMeals.length} menu: {item.sourceMeals
                        .slice(0, 2)
                        .map((source) => `${source.date} ${source.slot}`)
                        .join(", ")}
                      {item.sourceMeals.length > 2
                        ? ` +${item.sourceMeals.length - 2} lainnya`
                        : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </GlassCard>
      ))}

      {batchOpportunities.length > 0 && (
        <GlassCard>
          <section aria-labelledby="batch-cooking-heading">
            <h2 id="batch-cooking-heading" className="text-sm font-semibold text-rose-strong">
              Peluang batch cooking
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              Bahan ini muncul beberapa kali, jadi bisa kamu siapkan sekaligus kalau praktis.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {batchOpportunities.map((item) => (
                <li key={`${item.id}:${item.unit}`} className="rounded-control bg-petal-soft/60 px-3 py-2">
                  <p className="text-sm font-semibold text-ink">{item.name}</p>
                  <p className="text-xs text-ink-muted">
                    ~{item.estimatedQuantity} {item.unit} · dipakai di {item.occurrenceCount} menu
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </GlassCard>
      )}
    </div>
  );
}
