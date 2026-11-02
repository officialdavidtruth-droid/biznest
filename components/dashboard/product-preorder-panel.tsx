"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setProductPreorder } from "@/lib/actions/preorder";

const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm";

export function ProductPreorderPanel({ slug, productId, initial, taken }: {
  slug: string; productId: string; taken: number;
  initial: { enabled: boolean; shipsOn: string; limit: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [shipsOn, setShipsOn] = useState(initial.shipsOn);
  const [limit, setLimit] = useState(initial.limit);

  const save = () => start(async () => {
    const r = await setProductPreorder(slug, productId, { enabled, shipsOn, limit });
    if (!r.success) { toast.error(r.error); return; }
    toast.success(enabled ? "Pre-order saved." : "Pre-order turned off.");
    router.refresh();
  });

  return (
    <section className="mx-auto mt-6 max-w-4xl rounded-xl border p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Pre-order</h2>
          <p className="mt-1 text-xs text-muted-foreground">Sell this before it's in stock. Customers pay now and you ship by the date you set. While on, stock counts are ignored and never reduced — when the goods arrive, turn this off and enter your real stock.</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />Accept pre-orders</label>
      </div>
      {enabled && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold">Expected ship date (optional)<input type="date" value={shipsOn} onChange={(e) => setShipsOn(e.target.value)} className={input} /></label>
          <label className="grid gap-1 text-xs font-semibold">Maximum units (optional)<input type="number" min={1} step={1} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="No limit" className={input} /></label>
          <p className="text-xs text-muted-foreground sm:col-span-2">{taken} unit{taken === 1 ? "" : "s"} pre-ordered so far (cancelled and refunded orders don't count). The ship date is shown to customers as a promise — it doesn't close pre-orders by itself.</p>
        </div>
      )}
      <button onClick={save} disabled={pending} className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">{pending ? "Saving…" : "Save pre-order settings"}</button>
    </section>
  );
}
