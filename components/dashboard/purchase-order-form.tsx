"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { createPurchaseOrder, type PurchaseOrderLineInput } from "@/lib/actions/purchase-order";

export type PoLineOption = {
  key: string; // "product:<id>" or "variant:<id>"
  productId?: string;
  variantId?: string;
  label: string;
  defaultCost: number | null;
};

const EMPTY_LINE: PurchaseOrderLineInput = { description: "", quantityOrdered: 1, unitCost: 0 };

export function PurchaseOrderForm({
  storeSlug,
  suppliers,
  options,
  defaultSupplierId,
}: {
  storeSlug: string;
  suppliers: { id: string; name: string }[];
  options: PoLineOption[];
  defaultSupplierId?: string;
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(defaultSupplierId ?? "");
  const [notes, setNotes] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [lines, setLines] = useState<{ key: string; line: PurchaseOrderLineInput }[]>([
    { key: "", line: { ...EMPTY_LINE } },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const optionsByKey = useMemo(() => new Map(options.map((o) => [o.key, o])), [options]);
  const subtotal = lines.reduce((sum, l) => sum + l.line.quantityOrdered * l.line.unitCost, 0);

  function updateLine(index: number, patch: Partial<PurchaseOrderLineInput>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, line: { ...l.line, ...patch } } : l)));
  }

  function pickOption(index: number, key: string) {
    const opt = optionsByKey.get(key);
    setLines((prev) =>
      prev.map((l, i) =>
        i === index
          ? {
              key,
              line: {
                ...l.line,
                productId: opt?.productId,
                variantId: opt?.variantId,
                description: opt?.label ?? l.line.description,
                unitCost: opt?.defaultCost ?? l.line.unitCost,
              },
            }
          : l
      )
    );
  }

  function addLine() {
    setLines((prev) => [...prev, { key: "", line: { ...EMPTY_LINE } }]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit() {
    if (!supplierId) {
      toast.error("Choose a supplier.");
      return;
    }
    if (lines.some((l) => !l.line.productId && !l.line.variantId)) {
      toast.error("Every line needs a product.");
      return;
    }

    setIsSubmitting(true);
    const result = await createPurchaseOrder(storeSlug, {
      supplierId,
      notes: notes || undefined,
      expectedAt: expectedAt || undefined,
      items: lines.map((l) => l.line),
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.data.poNumber} created as a draft.`);
    router.push(`/${storeSlug}/admin/purchase-orders/${result.data.purchaseOrderId}`);
    router.refresh();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          Supplier
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
            <option value="">Choose a supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Expected date
          <input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
        </label>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">Line items</div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-end gap-2 rounded-md border p-2">
              <label className="flex flex-1 flex-col gap-1 text-xs">
                Product
                <select value={l.key} onChange={(e) => pickOption(i, e.target.value)} className="rounded-md border px-2 py-1.5 text-sm">
                  <option value="">Choose…</option>
                  {options.map((o) => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex w-24 flex-col gap-1 text-xs">
                Qty
                <input
                  type="number"
                  min="1"
                  value={l.line.quantityOrdered}
                  onChange={(e) => updateLine(i, { quantityOrdered: Number(e.target.value) })}
                  className="rounded-md border px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex w-28 flex-col gap-1 text-xs">
                Unit cost
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={l.line.unitCost}
                  onChange={(e) => updateLine(i, { unitCost: Number(e.target.value) })}
                  className="rounded-md border px-2 py-1.5 text-sm"
                />
              </label>
              <div className="w-24 pb-1.5 text-right text-sm text-muted-foreground">
                {(l.line.quantityOrdered * l.line.unitCost).toLocaleString()}
              </div>
              <button onClick={() => removeLine(i)} className="rounded-md p-2 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addLine} className="mt-2 flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <Plus className="h-4 w-4" /> Add line
        </button>
      </div>

      <label className="block text-sm">
        Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
      </label>

      <div className="flex items-center justify-between border-t pt-4">
        <div className="text-sm text-muted-foreground">
          Subtotal: <span className="font-medium text-foreground">{subtotal.toLocaleString()}</span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isSubmitting ? "Saving…" : "Save as draft"}
        </button>
      </div>
    </div>
  );
}
