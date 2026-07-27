"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreCollection } from "@/hooks";
import { shoppingRepository } from "@/lib/db/shopping.repository";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";
import type { ShoppingCategory, ShoppingItem } from "@/types/firestore";

const CATEGORIES: { value: ShoppingCategory; label: string }[] = [
  { value: "protein", label: "Protein" },
  { value: "produce", label: "Produce" },
  { value: "pantry", label: "Pantry" },
  { value: "dairy", label: "Dairy" },
  { value: "supplements", label: "Supplements" },
  { value: "other", label: "Other" },
];

export default function ShoppingPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ShoppingCategory>("other");
  const [adding, setAdding] = useState(false);

  const { data: items, loading } = useFirestoreCollection<ShoppingItem>(
    uid ? (onData, onError) => shoppingRepository.subscribeForUser(uid, onData, onError) : null,
    [uid],
  );

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!uid || !name.trim()) return;
    setAdding(true);
    try {
      await shoppingRepository.create({
        userId: uid,
        name: name.trim(),
        category,
        quantity: null,
        checked: false,
        addedFrom: "manual",
      });
      setName("");
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (id: string, checked: boolean) => {
    await shoppingRepository.toggleChecked(id, !checked);
  };

  const remove = async (id: string) => {
    await shoppingRepository.remove(id);
  };

  const grouped = CATEGORIES.map((c) => ({ ...c, items: items.filter((i) => i.category === c.value) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Shopping" description="Your running grocery list." />

      <GlassCard>
        <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Item"
              placeholder="e.g. Greek yogurt"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ShoppingCategory)}
              className="h-12 rounded-control border border-ink/10 bg-bg-elevated px-4 text-sm text-ink focus:border-rose"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" leadingIcon={<Plus size={16} />} isLoading={adding} disabled={!name.trim()}>
            Add
          </Button>
        </form>
      </GlassCard>

      {loading ? (
        <Skeleton className="h-40 w-full rounded-card" />
      ) : items.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={<ShoppingCart size={28} />}
            title="Your list is empty"
            description="Add staples above, or check things off as you shop."
          />
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map((group) => (
            <GlassCard key={group.value} padding="none" className="overflow-hidden">
              <p className="px-5 pt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {group.label}
              </p>
              <ul className="divide-y divide-ink/8">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => void toggle(item.id, item.checked)}
                      className="h-5 w-5 rounded accent-[var(--color-rose)]"
                      aria-label={`Mark ${item.name} as bought`}
                    />
                    <span className={cn("flex-1 text-sm text-ink", item.checked && "text-ink-faint line-through")}>
                      {item.name}
                    </span>
                    <button
                      onClick={() => void remove(item.id)}
                      aria-label="Remove item"
                      className="rounded-full p-2 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
