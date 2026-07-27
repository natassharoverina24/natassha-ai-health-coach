"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface QuickWaterFormProps {
  defaultAmountMl?: number;
  onSubmit: (amountMl: number) => Promise<void>;
  onCancel: () => void;
}

export function QuickWaterForm({ defaultAmountMl = 250, onSubmit, onCancel }: QuickWaterFormProps) {
  const [amount, setAmount] = useState(defaultAmountMl.toString());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log water.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        name="waterAmount"
        type="number"
        inputMode="decimal"
        label="Amount"
        suffix="ml"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        autoFocus
      />

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="mt-2 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" isLoading={submitting}>
          Log water
        </Button>
      </div>
    </form>
  );
}
