"use client";

import { useState, useTransition } from "react";
import { Award, Coins, Search, Users, X } from "lucide-react";
import { adjustLoyaltyPoints, type LoyaltyAccountView } from "@/lib/actions/loyalty-admin";
import { currencySymbol } from "@/lib/utils/format-money";
import { formatDate } from "@/lib/i18n/locale";

type Props = { slug: string; accounts: LoyaltyAccountView[]; rates: { pointsPerNaira: number; nairaPerPoint: number }; totals: { accounts: number; outstanding: number; earned30: number; redeemed30: number; liability: number } };
const TIER_TONE: Record<string, string> = { Member: "bg-muted text-muted-foreground", Silver: "bg-slate-200 text-slate-700", Gold: "bg-amber-100 text-amber-800", Platinum: "bg-violet-100 text-violet-800" };
const TIERS = [["Member", "Under 500 points earned"], ["Silver", "500 points earned"], ["Gold", "2,000 points earned"], ["Platinum", "5,000 points earned"]];
const n = (x: number) => x.toLocaleString();

export function LoyaltyWorkspace({ slug, accounts, rates, totals }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<LoyaltyAccountView | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const shown = accounts.filter((a) => !q.trim() || `${a.name} ${a.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const spendPerPoint = rates.pointsPerNaira > 0 ? Math.round(1 / rates.pointsPerNaira) : 0;

  function adjust(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!open) return;
    const f = new FormData(e.currentTarget);
    const id = open.id;
    start(async () => {
      const r = await adjustLoyaltyPoints(slug, id, Number(f.get("points")), String(f.get("note") ?? ""));
      if (r.success) location.reload(); else setMsg(r.error);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">BizNest Growth</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Loyalty rewards</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Customers earn points on paid orders and cash them out as coupons. See who your best customers are and correct or reward balances by hand.</p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-sm"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer" className="w-full min-w-0 bg-transparent outline-none sm:w-56" /></label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { l: "Members", v: n(totals.accounts), s: "Customers with points", I: Users },
          { l: "Points outstanding", v: n(totals.outstanding), s: `Worth ${currencySymbol()}${n(totals.liability)} if all cashed out`, I: Coins },
          { l: "Earned (30 days)", v: n(totals.earned30), s: "From paid orders", I: Award },
          { l: "Redeemed (30 days)", v: n(totals.redeemed30), s: "Cashed out as coupons", I: Coins },
        ].map(({ l, v, s, I }) => <div key={l} className="rounded-2xl border bg-background p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">{l}</span><I className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-bold">{v}</p><p className="mt-1 text-[11px] text-muted-foreground">{s}</p></div>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <section className="overflow-hidden rounded-2xl border bg-background shadow-sm">
          <div className="border-b px-5 py-4"><h2 className="text-sm font-bold">Customers</h2></div>
          <div className="divide-y">
            {shown.map((a) => (
              <button key={a.id} onClick={() => { setMsg(""); setOpen(a); }} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-muted/30">
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{a.name}</p><p className="truncate text-xs text-muted-foreground">{a.email}</p></div>
                <div className="flex shrink-0 items-center gap-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${TIER_TONE[a.tier]}`}>{a.tier}</span><b className="w-20 text-right text-sm tabular-nums">{n(a.balance)} pts</b></div>
              </button>
            ))}
            {shown.length === 0 && <p className="px-6 py-14 text-center text-sm text-muted-foreground">{accounts.length ? "No customers match." : "No one has earned points yet. Points are added automatically when a customer's order is paid."}</p>}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-background p-5 shadow-sm">
            <h2 className="text-sm font-bold">How points work</h2>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li>Earn: 1 point for every {currencySymbol()}{n(spendPerPoint)} spent on a paid order.</li>
              <li>Cash out: 1 point is worth {currencySymbol()}{rates.nairaPerPoint} as a single-use coupon.</li>
              <li>These rates are set for the whole BizNest platform.</li>
            </ul>
          </div>
          <div className="rounded-2xl border bg-background p-5 shadow-sm">
            <h2 className="text-sm font-bold">Tiers</h2>
            <ul className="mt-3 space-y-2">{TIERS.map(([t, d]) => <li key={t} className="flex items-center justify-between text-xs"><span className={`rounded-full px-2.5 py-1 font-bold ${TIER_TONE[t]}`}>{t}</span><span className="text-muted-foreground">{d}</span></li>)}</ul>
          </div>
        </aside>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-background shadow-xl">
            <div className="flex items-start justify-between border-b px-5 py-4"><div><h2 className="text-lg font-bold">{open.name}</h2><p className="text-xs text-muted-foreground">{open.email}</p></div><button onClick={() => setOpen(null)} aria-label="Close"><X /></button></div>
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <dl className="grid grid-cols-3 gap-2 text-center">{[["Balance", n(open.balance)], ["Earned", n(open.lifetimeEarned)], ["Redeemed", n(open.redeemed)]].map(([k, v]) => <div key={k} className="rounded-xl bg-muted/40 px-2 py-2.5"><dt className="text-[10px] text-muted-foreground">{k}</dt><dd className="text-sm font-bold">{v}</dd></div>)}</dl>
              {msg && <p className="rounded-lg border border-[var(--bn-admin-danger-line)] bg-[var(--bn-admin-danger-soft)] p-2.5 text-xs text-[var(--bn-admin-danger)]">{msg}</p>}
              <form onSubmit={adjust} className="grid gap-2.5 rounded-xl border p-3">
                <p className="text-xs font-bold">Adjust points</p>
                <div className="grid grid-cols-[7rem_1fr] gap-2"><input name="points" type="number" step="1" required placeholder="+50 or -50" aria-label="Points to add or remove" className="rounded-lg border bg-background px-3 py-2 text-sm" /><input name="note" required placeholder="Reason, e.g. Birthday bonus" aria-label="Reason" className="rounded-lg border bg-background px-3 py-2 text-sm" /></div>
                <button disabled={pending} className="rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground">{pending ? "Saving…" : "Apply adjustment"}</button>
              </form>
              <div><p className="mb-2 text-xs font-bold">Recent activity</p><ul className="divide-y rounded-xl border">{open.entries.map((e) => <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs"><span className="min-w-0 truncate">{e.type === "EARN" ? "Earned" : e.type === "REDEEM" ? "Redeemed" : "Adjusted"}{e.note ? ` · ${e.note}` : ""}<span className="block text-[10px] text-muted-foreground">{formatDate(new Date(e.createdAt))}</span></span><b className={e.points < 0 ? "text-[var(--bn-admin-danger)]" : ""}>{e.points > 0 ? "+" : ""}{n(e.points)}</b></li>)}{open.entries.length === 0 && <li className="px-3 py-4 text-center text-xs text-muted-foreground">No activity yet.</li>}</ul></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
