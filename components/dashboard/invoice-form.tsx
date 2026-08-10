"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { createInvoice, type InvoiceLineInput } from "@/lib/actions/invoice";

const EMPTY_ITEM: InvoiceLineInput = { description: "", quantity: 1, unitPrice: 0 };

export function InvoiceForm({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tax, setTax] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [items, setItems] = useState<InvoiceLineInput[]>([{ ...EMPTY_ITEM }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const total = subtotal + tax - discount + deliveryFee;

  function updateItem(index: number, patch: Partial<InvoiceLineInput>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    const result = await createInvoice(storeSlug, {
      customerName: customerName || undefined,
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      items,
      tax,
      discount,
      deliveryFee,
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
    setTax(0);
    setDiscount(0);
    setDeliveryFee(0);
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
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-[1fr_80px_110px_28px] items-center gap-2">
            <input
              value={item.description}
              onChange={(e) => updateItem(index, { description: e.target.value })}
              placeholder="Description"
              className="rounded-md border px-3 py-1.5 text-sm"
            />
            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
              className="rounded-md border px-3 py-1.5 text-sm"
            />
            <input
              type="number"
              min="0"
              value={item.unitPrice}
              onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })}
              placeholder="Unit price"
              className="rounded-md border px-3 py-1.5 text-sm"
            />
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
          Tax
          <input
            type="number"
            min="0"
            value={tax}
            onChange={(e) => setTax(Number(e.target.value))}
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Discount
          <input
            type="number"
            min="0"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Delivery fee
          <input
            type="number"
            min="0"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(Number(e.target.value))}
            className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm">
          Total: <strong>{total.toLocaleString()}</strong>
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
