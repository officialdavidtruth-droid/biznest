"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Search, WalletCards } from "lucide-react";
import { TableScroll } from "@/components/ui/table-scroll";
import { FilterChip, StatusChip, btnGhost, btnPrimary, panelCls, shortDate } from "@/components/dashboard/pms-ui";

type Props = {
  reservations: any[];
  money: (n: number) => string;
  /** Resolves true when the payment link was created. */
  onRequestPayment: (reservation: any, amount: number) => Promise<boolean>;
};

const isOpen = (r: any) => r.paymentStatus !== "PAID" && !["CANCELLED", "NO_SHOW"].includes(r.status);

export function PmsBilling({ reservations, money, onRequestPayment }: Props) {
  const [filter, setFilter] = useState<"UNPAID" | "PAID" | "ALL">("UNPAID");
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const unpaid = reservations.filter(isOpen);
  const paid = reservations.filter((r) => r.paymentStatus === "PAID");
  const collected = paid.reduce((s, r) => s + Number(r.depositAmount || 0), 0);
  const requested = unpaid.reduce((s, r) => s + Number(r.depositAmount || 0), 0);
  const billable = reservations.filter((r) => !["CANCELLED", "NO_SHOW"].includes(r.status)).length;

  const rows = useMemo(() => reservations
    .filter((r) => (filter === "ALL" ? true : filter === "PAID" ? r.paymentStatus === "PAID" : isOpen(r)))
    .filter((r) => !q.trim() || `${r.guest?.fullName ?? ""} ${r.room?.name ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => +new Date(b.checkIn) - +new Date(a.checkIn)), [reservations, filter, q]);

  const send = async (r: any) => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    const ok = await onRequestPayment(r, n);
    setBusy(false);
    if (ok) { setAsking(null); setAmount(""); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Billing & payments</h2>
          <p className="mt-1 text-sm text-[var(--bn-admin-text)]">See what has been paid and send guests a secure payment link.</p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm focus-within:border-emerald-400/50">
          <Search className="h-4 w-4 opacity-60" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guest or room" className="w-full min-w-0 bg-transparent outline-none placeholder:opacity-50 sm:w-60" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Collected", value: money(collected), sub: `${paid.length} paid ${paid.length === 1 ? "stay" : "stays"}`, icon: CheckCircle2, tone: "text-emerald-300" },
          { label: "Awaiting payment", value: String(unpaid.length), sub: unpaid.length ? "Stays with nothing paid yet" : "All settled", icon: CreditCard, tone: unpaid.length ? "text-amber-300" : "text-emerald-300" },
          { label: "Payment requested", value: money(requested), sub: "Deposits asked for, not yet paid", icon: WalletCards, tone: "text-sky-300" },
          { label: "Coverage", value: `${billable ? Math.round((paid.length / billable) * 100) : 0}%`, sub: "Of active stays are paid", icon: CheckCircle2, tone: "text-violet-300" },
        ].map((c) => (
          <div key={c.label} className={`${panelCls} p-5`}>
            <div className="flex items-center justify-between text-sm text-[var(--bn-admin-text)]"><span>{c.label}</span><c.icon className={`h-4 w-4 ${c.tone}`} /></div>
            <p className="mt-4 text-3xl font-semibold tabular-nums">{c.value}</p>
            <p className="mt-1.5 text-xs text-[var(--bn-admin-text)] opacity-70">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "UNPAID"} onClick={() => setFilter("UNPAID")} label="Awaiting payment" count={unpaid.length} dot="bg-amber-400" />
        <FilterChip active={filter === "PAID"} onClick={() => setFilter("PAID")} label="Paid" count={paid.length} dot="bg-emerald-400" />
        <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")} label="All" count={reservations.length} />
      </div>

      <div className={`${panelCls} overflow-hidden`}>
        <TableScroll>
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs text-[var(--bn-admin-text)]">
              <tr>{["Guest", "Stay", "Payment", "Deposit", ""].map((h, i) => <th key={i} className="px-5 py-3.5 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const canAsk = isOpen(r) && !["CHECKED_OUT"].includes(r.status);
                return (
                  <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="px-5 py-4"><p className="font-medium">{r.guest?.fullName}</p><p className="text-xs text-[var(--bn-admin-text)] opacity-70">{r.guest?.email || r.guest?.phone || "No contact"}</p></td>
                    <td className="px-5 py-4"><p>{r.room?.name}</p><p className="text-xs tabular-nums text-[var(--bn-admin-text)] opacity-70">{shortDate(r.checkIn)} to {shortDate(r.checkOut)}</p></td>
                    <td className="px-5 py-4"><StatusChip status={r.paymentStatus || "UNPAID"} /></td>
                    <td className="px-5 py-4 tabular-nums">{r.depositAmount ? money(Number(r.depositAmount)) : <span className="opacity-50">None</span>}</td>
                    <td className="px-5 py-4">
                      {!canAsk ? <span className="text-xs opacity-50">{r.paymentStatus === "PAID" ? "Paid in full" : "Nothing to collect"}</span> : asking === r.id ? (
                        <div className="flex items-center gap-2">
                          <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(r); if (e.key === "Escape") setAsking(null); }} placeholder="Amount" aria-label="Amount to request" className="w-28 rounded-lg border border-white/15 bg-black/25 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400/60" />
                          <button className={btnPrimary} disabled={busy || !(Number(amount) > 0)} onClick={() => send(r)}>{busy ? "Sending…" : "Send link"}</button>
                          <button className={btnGhost} onClick={() => setAsking(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button className={btnPrimary} onClick={() => { setAsking(r.id); setAmount(r.depositAmount ? String(Number(r.depositAmount)) : ""); }}>Request payment</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-[var(--bn-admin-text)]">{filter === "UNPAID" ? "Nothing is waiting for payment." : "No stays to show."}</td></tr>}
            </tbody>
          </table>
        </TableScroll>
      </div>
    </div>
  );
}
