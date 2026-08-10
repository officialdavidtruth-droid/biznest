"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendPurchaseOrder, cancelPurchaseOrder, receivePurchaseOrder } from "@/lib/actions/purchase-order";

type Item = { id: string; description: string; quantityOrdered: number; quantityReceived: number; unitCost: number };

export function PurchaseOrderActions({
  storeSlug,
  poId,
  status,
  items,
}: {
  storeSlug: string;
  poId: string;
  status: string;
  items: Item[];
}) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});

  async function handleSend() {
    setIsBusy(true);
    const result = await sendPurchaseOrder(storeSlug, poId);
    setIsBusy(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Purchase order sent.");
    router.refresh();
  }

  async function handleCancel() {
    if (!confirm("Cancel this purchase order?")) return;
    setIsBusy(true);
    const result = await cancelPurchaseOrder(storeSlug, poId);
    setIsBusy(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Purchase order cancelled.");
    router.refresh();
  }

  function fillRemaining() {
    const next: Record<string, string> = {};
    for (const item of items) {
      const remaining = item.quantityOrdered - item.quantityReceived;
      if (remaining > 0) next[item.id] = String(remaining);
    }
    setReceiveQty(next);
  }

  async function handleReceive() {
    const lines = Object.entries(receiveQty)
      .map(([itemId, v]) => ({ itemId, quantity: Number(v) }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) {
      toast.error("Enter a received quantity for at least one line.");
      return;
    }
    setIsBusy(true);
    const result = await receivePurchaseOrder(storeSlug, poId, lines);
    setIsBusy(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Stock received and inventory updated.");
    setReceiveQty({});
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {status === "DRAFT" && (
          <button onClick={handleSend} disabled={isBusy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            Mark as sent
          </button>
        )}
        {(status === "DRAFT" || status === "SENT") && (
          <button onClick={handleCancel} disabled={isBusy} className="rounded-md border px-4 py-2 text-sm font-medium text-destructive disabled:opacity-50">
            Cancel PO
          </button>
        )}
      </div>

      {(status === "SENT" || status === "PARTIALLY_RECEIVED") && (
        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Receive stock</h3>
            <button onClick={fillRemaining} className="text-xs font-medium text-primary hover:underline">
              Fill all remaining
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item) => {
              const remaining = item.quantityOrdered - item.quantityReceived;
              return (
                <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex-1">{item.description}</span>
                  <span className="w-28 text-xs text-muted-foreground">{item.quantityReceived}/{item.quantityOrdered} received</span>
                  <input
                    type="number"
                    min="0"
                    max={remaining}
                    disabled={remaining === 0}
                    placeholder="0"
                    value={receiveQty[item.id] ?? ""}
                    onChange={(e) => setReceiveQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    className="w-24 rounded-md border px-2 py-1.5 text-sm disabled:opacity-50"
                  />
                </div>
              );
            })}
          </div>
          <button
            onClick={handleReceive}
            disabled={isBusy}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isBusy ? "Receiving…" : "Receive stock"}
          </button>
        </div>
      )}
    </div>
  );
}
