"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { createInvoice, type InvoiceLineInput } from "@/lib/actions/invoice";
import { formatNumber } from "@/lib/i18n/locale";

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

export function InvoiceForm({ storeSlug, currency = "NGN", defaultOpen = true }: { storeSlug: string; currency?: string; defaultOpen?: boolean }) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tax, setTax] = useState("");
  const [discount, setDiscount] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ ...EMPTY_ITEM }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(defaultOpen);

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

  const inputCls = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm";
  return (
    <section className="mb-5 rounded-2xl border bg-background shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold">New invoice</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
      <div className="space-y-5 border-t p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" className={inputCls} />
          <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Email (optional)" type="email" inputMode="email" className={inputCls} />
          <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone (optional)" type="tel" inputMode="tel" className={inputCls} />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">Items</p>
          {items.map((item, index) => (
            <div key={index} className="rounded-xl border bg-muted/30 p-3">
              <div className="flex items-start gap-2">
                <input
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  placeholder="Item, e.g. Blue T-shirt"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  aria-label="Remove item"
                  className="rounded-xl border bg-background p-2.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-[90px_1fr_auto] items-center gap-2">
                <label className="block text-[11px] text-muted-foreground">
                  Qty
                  <input type="number" inputMode="numeric" min="1" value={item.quantity} onChange={(e) => updateItem(index, { quantity: e.target.value })} placeholder="1" className={`${inputCls} mt-1`} />
                </label>
                <label className="block text-[11px] text-muted-foreground">
                  Unit price ({currency})
                  <input type="number" inputMode="decimal" min="0" value={item.unitPrice} onChange={(e) => updateItem(index, { unitPrice: e.target.value })} placeholder="0.00" className={`${inputCls} mt-1`} />
                </label>
                <p className="pt-5 text-right text-sm font-semibold tabular-nums">
                  {formatNumber(parseMoney(item.quantity) * parseMoney(item.unitPrice))}
                </p>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-xs font-semibold text-primary hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Add line item
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
          {([["Tax", tax, setTax], ["Discount", discount, setDiscount], ["Delivery", deliveryFee, setDeliveryFee]] as const).map(([label, val, set]) => (
            <label key={label} className="block text-[11px] text-muted-foreground">
              {label} ({currency})
              <input type="number" inputMode="decimal" min="0" value={val} onChange={(e) => set(e.target.value)} placeholder="0" className={`${inputCls} mt-1`} />
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold tabular-nums">{currency} {formatNumber(total)}</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:py-2.5"
          >
            {isSubmitting ? "Creating…" : "Create invoice"}
          </button>
        </div>
      </div>
      )}
    </section>
  );
}
