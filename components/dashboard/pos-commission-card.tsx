"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordPosCommissionSettlement, type PosCommissionBalance } from "@/lib/actions/pos";

export function PosCommissionCard({ slug, balance }: { slug: string; balance: PosCommissionBalance }) {
  const router = useRouter();
  const [amount, setAmount] = useState(balance.owed > 0 ? String(balance.owed) : "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function handleSettle() {
    setSubmitting(true);
    const result = await recordPosCommissionSettlement(slug, Number(amount), note);
    setSubmitting(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Settlement recorded.");
    setShowForm(false);
    setNote("");
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs uppercase text-muted-foreground">POS commission owed</p>
      <p className="mt-1 text-2xl font-semibold">
        {balance.currency} {balance.owed.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Accrues from in-person sales since cash isn&apos;t split automatically like online orders.
      </p>

      {balance.owed > 0 && !showForm && (
        <button onClick={() => setShowForm(true)} className="mt-3 text-xs font-medium text-primary hover:underline">
          Record a settlement
        </button>
      )}

      {showForm && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <input
            type="number"
            min="0"
            max={balance.owed}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount settled"
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (e.g. bank transfer ref)"
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSettle}
              disabled={submitting}
              className="flex-1 rounded-md bg-primary py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Confirm settlement"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {balance.recentSettlements.length > 0 && (
        <div className="mt-3 space-y-1 border-t pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">Recent settlements</p>
          {balance.recentSettlements.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{s.note || "Settlement"} · {s.settledByEmail}</span>
              <span>{balance.currency} {s.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
