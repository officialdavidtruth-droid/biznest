"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { updateQuote, withdrawQuote, type QuoteLineInput } from "@/lib/actions/quote";
import { formatNumber } from "@/lib/i18n/locale";

type Props = {
  storeSlug: string;
  quoteId: string;
  status: "DRAFT" | "SENT";
  currency: string;
  initialItems: QuoteLineInput[];
  initialDeposit: number | null;
  initialExpiresAt: string; // yyyy-mm-dd or ""
};

/** Edit prices / deposit / expiry of an unanswered quote, or withdraw it once sent. */
export function QuoteEditor({ storeSlug, quoteId, status, currency, initialItems, initialDeposit, initialExpiresAt }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<QuoteLineInput[]>(initialItems.length ? initialItems : [{ description: "", quantity: 1, unitPrice: 0 }]);
  const [deposit, setDeposit] = useState(initialDeposit ? String(initialDeposit) : "");
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [busy, setBusy] = useState(false);

  const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const patch = (index: number, p: Partial<QuoteLineInput>) => setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...p } : item)));

  async function save() {
    setBusy(true);
    const result = await updateQuote(storeSlug, quoteId, {
      items,
      depositRequired: deposit ? Number(deposit) : null,
      expiresAt: expiresAt || undefined,
    });
    setBusy(false);
    if (!result.success) return void toast.error(result.error);
    toast.success(status === "SENT" ? "Quote updated. The customer's link shows the new figures." : "Quote updated.");
    router.refresh();
  }

  async function withdraw() {
    if (!window.confirm("Withdraw this quote? The customer will no longer be able to accept it.")) return;
    setBusy(true);
    const result = await withdrawQuote(storeSlug, quoteId);
    setBusy(false);
    if (!result.success) return void toast.error(result.error);
    if (result.data.depositInFlight) {
      toast.warning("Quote withdrawn. A customer was mid-payment on the deposit; check Payments for review and refund it if needed.");
    } else {
      toast.success("Quote withdrawn.");
    }
    router.refresh();
  }

  return (
    <section className="rounded-2xl border bg-background p-6">
      <h2 className="font-semibold">Quote pricing</h2>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">
        {status === "SENT"
          ? "This quote is live. Changes apply immediately to the link the customer already has."
          : "Prepare the line items, deposit and expiry before sending."}
      </p>

      <div className="mb-3 space-y-2">
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-[1fr_70px_110px_28px] items-center gap-2">
            <input value={item.description} onChange={(e) => patch(index, { description: e.target.value })} placeholder="Description" className="rounded-md border px-3 py-1.5 text-sm" />
            <input type="number" min="1" value={item.quantity} onChange={(e) => patch(index, { quantity: Number(e.target.value) })} className="rounded-md border px-3 py-1.5 text-sm" />
            <input type="number" min="0" value={item.unitPrice} onChange={(e) => patch(index, { unitPrice: Number(e.target.value) })} className="rounded-md border px-3 py-1.5 text-sm" />
            <button type="button" onClick={() => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))} disabled={items.length === 1} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }])} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <Plus className="h-3.5 w-3.5" /> Add line item
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground">
          Deposit required (optional)
          <input type="number" min="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-muted-foreground">
          Expires on
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm" />
          <span className="mt-1 block text-[11px]">Left blank, the quote is valid for 30 days from sending.</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">Total: <strong>{currency} {formatNumber(total)}</strong></p>
        <div className="flex gap-2">
          {status === "SENT" && (
            <button onClick={withdraw} disabled={busy} className="rounded-md border border-destructive/40 px-4 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50">
              Withdraw quote
            </button>
          )}
          <button onClick={save} disabled={busy} className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </section>
  );
}
