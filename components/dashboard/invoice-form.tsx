"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { createInvoice, type InvoiceLineInput } from "@/lib/actions/invoice";

// Line items are edited as strings so the field can sit empty mid-edit
// (typing over "0", deleting to clear it) without React snapping it back
// to "0" on every keystroke. Parsed to a number only at submit time.
type DraftItem = { description: string; quantity: string; unitPrice: string };
const EMPTY_ITEM: DraftItem = { description: "", quantity: "1", unitPrice: "" };

// Same empty-field problem applies to Tax/Discount/Delivery fee, so those
// are strings too; parseMoney below is the single place "" becomes 0.
function parseMoney(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function InvoiceForm({ storeSlug, currency = "NGN" }: { storeSlug: string; currency?: string }) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tax, setTax] = useState("");
  const [discount, setDiscount] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ ...EMPTY_ITEM }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = items.reduce((sum, i) => sum + parseMoney(i.quantity) * parseMoney(i.unitPrice), 0);
  const total = subtotal + parseMoney(tax) - parseMoney(discount) + parseMoney(deliveryFee);

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit() {
    const parsedItems: InvoiceLineInput[] = items.map((i) => ({
      description: i.description,
      quantity: parseMoney(i.quantity) || 1,
      unitPrice: parseMoney(i.unitPrice),
    }));
    if (parsedItems.some((i) => !i.description.trim())) {
      toast.error("Every line item needs a description.");
      return;
    }

    setIsSubmitting(true);
    const result = await createInvoice(storeSlug, {
      customerName: customerName || undefined,
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      items: parsedItems,
      tax: parseMoney(tax),
      discount: parseMoney(discount),
      deliveryFee: parseMoney(deliveryFee),
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Invoice ${result.data.invoiceNo} created.`);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setTax("");
    setDiscount("");
    setDeliveryFee("");
    setItems([{ ...EMPTY_ITEM }]);
    router.refresh();
  }

  return (
    <div className="mb-6 rounded-lg border bg-background p-4">
      <h2 className="mb-3 text-sm font-semibold">New invoice</h2>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Customer name"
          className="rounded-md border px-3 py-1.5 text-sm"
        />
        <input
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          placeholder="Email (optional)"
          type="email"
          className="rounded-md border px-3 py-1.5 text-sm"
        />
        <input
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder="Phone (optional)"
          className="rounded-md border px-3 py-1.5 text-sm"
        />
      </div>

      <div className="mb-3 space-y-2">
        <div className="grid grid-cols-[1fr_80px_110px_28px] gap-2 px-0.5 text-[11px] font-medium text-muted-foreground">
          <span>Description</span>
          <span>Qty</span>
          <span>Unit price ({currency})</span>
          <span />
        </div>
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-[1fr_80px_110px_28px] items-center gap-2">
            <input
              value={item.description}
              onChange={(e) => updateItem(index, { description: e.target.value })}
              placeholder="e.g. Blue T-shirt (Large)"
              className="rounded-md border px-3 py-1.5 text-sm"
            />
            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) => updateItem(index, { quantity: e.target.value })}
              placeholder="1"
              className="rounded-md border px-3 py-1.5 text-sm"
            />
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {currency}
              </span>
              <input
                type="number"
                min="0"
                value={item.unitPrice}
                onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                placeholder="0.00"
                className="w-full rounded-md border py-1.5 pl-11 pr-3 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => removeItem(index)}
              disabled={items.length === 1}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Add line item
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 sm:w-1/2">
        <label className="text-xs text-muted-foreground">
          Tax ({currency})
          <input
            type="number"
            min="0"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Discount ({currency})
          <input
            type="number"
            min="0"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Delivery fee ({currency})
          <input
            type="number"
            min="0"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm">
          Total: <strong>{currency} {total.toLocaleString()}</strong>
        </p>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isSubmitting ? "Creating…" : "Create invoice"}
        </button>
      </div>
    </div>
  );
}
