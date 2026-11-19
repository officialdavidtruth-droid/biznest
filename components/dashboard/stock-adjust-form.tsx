"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adjustStock, updateLowStockThreshold } from "@/lib/actions/inventory";
import type { StockMovementType } from "@prisma/client";

const ADJUSTABLE_TYPES: { value: StockMovementType; label: string; sign: 1 | -1 }[] = [
  { value: "RESTOCK", label: "Restock (add stock)", sign: 1 },
  { value: "RETURN", label: "Customer return (add stock)", sign: 1 },
  { value: "MANUAL_ADJUSTMENT", label: "Remove stock (damaged, lost, etc.)", sign: -1 },
  { value: "CORRECTION", label: "Correction (add stock)", sign: 1 },
];

const field = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm";

export function StockAdjustForm({
  storeSlug,
  inventoryItemId,
  currentThreshold,
}: {
  storeSlug: string;
  inventoryItemId: string;
  currentThreshold: number;
}) {
  const router = useRouter();
  const [type, setType] = useState<StockMovementType>("RESTOCK");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [threshold, setThreshold] = useState(String(currentThreshold));
  const [submitting, setSubmitting] = useState(false);
  const [savingThreshold, setSavingThreshold] = useState(false);

  async function handleAdjust() {
    const qty = Number(amount);
    if (!qty || qty <= 0) {
      toast.error("Enter an amount greater than zero.");
      return;
    }
    const config = ADJUSTABLE_TYPES.find((t) => t.value === type)!;
    setSubmitting(true);
    const result = await adjustStock(storeSlug, inventoryItemId, qty * config.sign, type, note || undefined);
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Stock updated — now ${result.data.quantity} on hand.`);
    setAmount("");
    setNote("");
    router.refresh();
  }

  async function handleThresholdSave() {
    setSavingThreshold(true);
    const result = await updateLowStockThreshold(storeSlug, inventoryItemId, Number(threshold));
    setSavingThreshold(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Low-stock threshold updated.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-background p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-sm font-semibold">Adjust stock</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as StockMovementType)}
            className={`${field} sm:col-span-1`}
          >
            {ADJUSTABLE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className={field}
            inputMode="numeric"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className={field}
          />
        </div>
        <button
          onClick={handleAdjust}
          disabled={submitting}
          className="mt-3 w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto sm:py-2.5"
        >
          {submitting ? "Saving…" : "Apply"}
        </button>
      </div>

      <div className="rounded-2xl border bg-background p-4 shadow-sm sm:p-5">
        <h2 className="mb-1 text-sm font-semibold">Low-stock alert threshold</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          You'll get an email the moment stock drops to or below this number.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            inputMode="numeric"
            className="w-28 rounded-xl border bg-background px-3 py-2.5 text-sm"
          />
          <button
            onClick={handleThresholdSave}
            disabled={savingThreshold}
            className="rounded-xl border px-5 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            {savingThreshold ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
