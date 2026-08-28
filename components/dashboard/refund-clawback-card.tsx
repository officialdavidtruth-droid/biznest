"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordRefundClawbackSettlement } from "@/lib/actions/refund";

type ClawbackBalance = {
  owed: number;
  currency: string;
  recentClawbacks: { id: string; amount: number; reason: string; createdAt: Date }[];
  recentSettlements: { id: string; amount: number; note: string | null; settledByEmail: string; createdAt: Date }[];
};

/**
 * Staff-only card (see assertStaffAccess in lib/actions/refund.ts) showing
 * what the platform is owed back from a merchant because it fronted their
 * already-settled share on a refund — see StoreRefundClawback. Mirrors
 * PosCommissionCard's shape deliberately; same settle-a-balance pattern,
 * opposite direction of who owes whom.
 */
export function RefundClawbackCard({ slug, balance }: { slug: string; balance: ClawbackBalance }) {
  const router = useRouter();
  const [amount, setAmount] = useState(balance.owed > 0 ? String(balance.owed) : "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function handleSettle() {
    setSubmitting(true);
    const result = await recordRefundClawbackSettlement(slug, Number(amount), note);
    setSubmitting(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Clawback settlement recorded.");
    setShowForm(false);
    setNote("");
    router.refresh();
  }

  if (balance.owed <= 0 && balance.recentClawbacks.length === 0) return null;

  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs uppercase text-muted-foreground">Refund clawback owed to platform</p>
      <p className="mt-1 text-2xl font-semibold">
        {balance.currency} {balance.owed.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Merchant share the platform fronted on refunds issued after the split had already settled — Paystack
        doesn&apos;t auto-reclaim that once it&apos;s in the merchant&apos;s bank account.
      </p>

      {balance.owed > 0 && !showForm && (
        <button onClick={() => setShowForm(true)} className="mt-3 text-xs font-medium text-primary hover:underline">
          Record a recovery
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
            placeholder="Amount recovered"
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (e.g. deducted from next payout)"
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSettle}
              disabled={submitting}
              className="flex-1 rounded-md bg-primary py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Confirm recovery"}
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

      {balance.recentClawbacks.length > 0 && (
        <div className="mt-3 space-y-1 border-t pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">Recent clawbacks</p>
          {balance.recentClawbacks.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate pr-2">{c.reason}</span>
              <span className="shrink-0">{balance.currency} {c.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {balance.recentSettlements.length > 0 && (
        <div className="mt-3 space-y-1 border-t pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">Recent recoveries</p>
          {balance.recentSettlements.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{s.note || "Recovery"} · {s.settledByEmail}</span>
              <span>{balance.currency} {s.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
