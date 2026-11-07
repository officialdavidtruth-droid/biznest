"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { releaseAllPayouts, releaseStorePayouts, retryQueuedPayouts, type PayoutWallet, type ReleaseSummary } from "@/lib/actions/admin-payouts";
import { TableScroll } from "@/components/ui/table-scroll";

const naira = (n: number) => `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
const GATEWAY_LABEL = { PAYSTACK: "Paystack", FLUTTERWAVE: "Flutterwave", KORAPAY: "Korapay" } as const;

function describe(s: ReleaseSummary) {
  if (s.released === 0) return "Nothing to send.";
  const parts = [`${s.released} queued`];
  if (s.paid) parts.push(`${s.paid} paid`);
  if (s.processing) parts.push(`${s.processing} sending`);
  if (s.stillQueued) parts.push(`${s.stillQueued} waiting (balance, bank details or next sweep)`);
  if (s.failed) parts.push(`${s.failed} failed, see Needs attention`);
  return parts.join(" · ");
}

export function PayoutWalletPanel({ wallet }: { wallet: PayoutWallet }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyStore, setBusyStore] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const short = wallet.gatewayBalance !== null && wallet.gatewayBalance < wallet.heldTotal;

  function run(storeId: string | null, fn: () => Promise<{ success: true; data: ReleaseSummary } | { success: false; error: string }>) {
    setMessage(null);
    setBusyStore(storeId ?? "ALL");
    start(async () => {
      const res = await fn();
      setMessage(res.success ? { ok: true, text: describe(res.data) } : { ok: false, text: res.error });
      setBusyStore(null);
      router.refresh();
    });
  }

  return (
    <section className="mb-6 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Payout wallet</h2>
          <p className="text-xs text-muted-foreground">
            Automatic mode: every sale is paid to the store straight away. Anything already held can be released below.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-muted/40 p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Held for stores</p>
          <p className="text-lg font-semibold">{naira(wallet.heldTotal)}</p>
          <p className="text-[11px] text-muted-foreground">{wallet.heldCount} payout{wallet.heldCount === 1 ? "" : "s"}</p>
        </div>
        <div className="rounded-md bg-muted/40 p-3">
          <p className="text-[11px] uppercase text-muted-foreground">{GATEWAY_LABEL[wallet.gateway]} balance</p>
          <p className="text-lg font-semibold">{wallet.gatewayBalance === null ? "Unavailable" : naira(wallet.gatewayBalance)}</p>
          <p className={`text-[11px] ${short ? "text-red-600" : "text-muted-foreground"}`}>{short ? "Less than what is held" : "Payouts are sent from this"}</p>
        </div>
        <div className="flex flex-col justify-center gap-2">
          <button
            disabled={pending || wallet.heldCount === 0}
            onClick={() => {
              if (window.confirm(`Pay out ${naira(wallet.heldTotal)} to ${wallet.stores.length} store${wallet.stores.length === 1 ? "" : "s"} now?`)) run(null, releaseAllPayouts);
            }}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busyStore === "ALL" ? "Paying out…" : "Pay out all stores"}
          </button>
          <button
            disabled={pending || wallet.queuedCount === 0}
            onClick={() => run(null, retryQueuedPayouts)}
            className="w-full rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {busyStore === "ALL" ? "Retrying…" : `Retry queued payouts (${wallet.queuedCount})`}
          </button>
          {wallet.heldCount === 0 && wallet.queuedCount === 0 && <p className="text-[11px] text-muted-foreground">Nothing is waiting to be paid.</p>}
        </div>
      </div>

      {wallet.heldNoBank > 0 && (
        <p className="mt-3 text-xs text-amber-700">
          {naira(wallet.heldNoBank)} belongs to stores that have not connected a bank account. It will be queued and sent once they connect one.
        </p>
      )}
      {message && <p className={`mt-3 text-xs ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}

      {wallet.stores.length > 0 && (
        <TableScroll className="mt-4">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="border-b text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Store</th>
                <th className="py-2 pr-4">Held</th>
                <th className="py-2 pr-4">Bank</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {wallet.stores.map((s) => (
                <tr key={s.storeId} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{s.name}</td>
                  <td className="py-2 pr-4">{naira(s.total)} <span className="text-[11px] text-muted-foreground">({s.count})</span></td>
                  <td className="py-2 pr-4 text-xs">{s.hasBank ? "Connected" : <span className="text-amber-700">Not connected</span>}</td>
                  <td className="py-2 text-right">
                    <button
                      disabled={pending}
                      onClick={() => run(s.storeId, () => releaseStorePayouts(s.storeId))}
                      className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      {busyStore === s.storeId ? "Paying…" : "Pay out"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </section>
  );
}