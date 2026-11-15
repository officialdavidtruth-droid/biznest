"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ClipboardCheck, Download } from "lucide-react";
import { toast } from "sonner";
import { getStockValuation, syncInventoryLedger, type StockRow } from "@/lib/actions/financial-reports";
import { formatMoney } from "@/lib/utils/format-money";
import { toCsv } from "@/lib/financial/statements";
import { Badge, Chip, Stat, btnGhost, btnPrimary, card, download, field } from "@/components/dashboard/fin-ui";

type Valuation = Extract<Awaited<ReturnType<typeof getStockValuation>>, { success: true }>["data"];
const STATUS: Record<StockRow["status"], { label: string; tone: string }> = {
  OK: { label: "In stock", tone: "green" }, LOW: { label: "Low", tone: "amber" }, OUT: { label: "Out", tone: "red" }, NO_COST: { label: "No cost set", tone: "blue" }, SLOW: { label: "Not selling", tone: "grey" },
};

export function FinancialStock({ slug, onStartAudit }: { slug: string; onStartAudit: () => void }) {
  const [data, setData] = useState<Valuation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | StockRow["status"]>("ALL");
  const [q, setQ] = useState("");
  const [busy, start] = useTransition();

  const load = () => start(async () => {
    const res = await getStockValuation(slug);
    if (res.success) { setData(res.data); setError(null); } else setError(res.error);
  });
  useEffect(load, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const money = (n: number) => formatMoney(n, data?.currency);
  const rows = useMemo(() => (data?.rows ?? [])
    .filter((r) => (filter === "ALL" || r.status === filter) && (!q.trim() || `${r.name} ${r.sku ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => b.costValue - a.costValue), [data, filter, q]);

  const sync = () => {
    if (!data) return;
    const d = data.ledger.difference;
    const msg = d > 0
      ? `Add ${money(d)} of stock to the Inventory account (booked as opening stock in Owner Equity)?`
      : `Write ${money(Math.abs(d))} off the Inventory account (booked to Cost of Goods Sold)?`;
    if (!confirm(msg)) return;
    start(async () => {
      const res = await syncInventoryLedger(slug);
      if (res.success) { toast.success(`Ledger updated (${res.data.reference})`); load(); } else toast.error(res.error);
    });
  };

  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;
  if (!data) return <div className={`${card} px-4 py-16 text-center text-sm text-[var(--bn-admin-muted)]`}>Valuing your stock…</div>;
  const { totals, ledger, flags } = data;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-xl font-bold">Stock accounting</h2><p className="mt-1 text-sm text-[var(--bn-admin-muted)]">What you hold, what it cost, what it should sell for, and whether the books agree.</p></div>
        <div className="flex gap-2">
          <button className={btnGhost} onClick={() => download("stock-valuation.csv", toCsv([["Item", "SKU", "Qty", "Unit cost", "Selling price", "Cost value", "Retail value", "Margin %", "Sold (30 days)", "Status"], ...data.rows.map((r) => [r.name, r.sku, r.quantity, r.costPrice, r.price, r.costValue, r.retailValue, r.marginPct, r.sold30d, STATUS[r.status].label])]))}><Download className="h-3.5 w-3.5" /> Excel / CSV</button>
          <button className={btnPrimary} onClick={onStartAudit}><ClipboardCheck className="h-3.5 w-3.5" /> Start a stock count</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Stock at cost" value={money(totals.costValue)} sub={`${totals.units.toLocaleString()} units · ${totals.items} items`} />
        <Stat label="Stock at selling price" value={money(totals.retailValue)} sub="If everything sold at list price" />
        <Stat label="Potential profit" value={money(totals.potentialProfit)} sub={totals.retailValue ? `${Math.round((totals.potentialProfit / totals.retailValue) * 100)}% of selling value` : undefined} tone="good" />
        <Stat label="Needs attention" value={String(flags.out + flags.low + flags.noCost)} sub={`${flags.out} out · ${flags.low} low · ${flags.noCost} without a cost`} tone={flags.out + flags.low > 0 ? "bad" : undefined} />
      </div>

      <div className={`${card} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <p className="text-sm font-bold">Ledger check</p>
          <p className="mt-1 text-xs text-[var(--bn-admin-muted)]">Inventory account in the books: <b className="text-[var(--bn-admin-text)]">{money(ledger.balance)}</b> · Stock valuation: <b className="text-[var(--bn-admin-text)]">{money(totals.costValue)}</b></p>
        </div>
        {Math.abs(ledger.difference) < 0.01
          ? <Badge tone="green">The books match your stock</Badge>
          : <div className="flex items-center gap-3"><Badge tone="amber">{ledger.difference > 0 ? "Books are short by" : "Books are over by"} {money(Math.abs(ledger.difference))}</Badge><button className={btnGhost} disabled={busy || !ledger.accountId} onClick={sync}>Bring the books in line</button></div>}
      </div>
      {flags.noCost > 0 && <p className="text-xs text-[var(--bn-admin-muted)]">{flags.noCost} item{flags.noCost === 1 ? " has" : "s have"} no cost price, so they count as zero in the valuation. Set a cost on each product to value it properly.</p>}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["ALL", "OUT", "LOW", "NO_COST", "SLOW", "OK"] as const).map((s) => <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>{s === "ALL" ? `All ${data.rows.length}` : `${STATUS[s].label} ${data.rows.filter((r) => r.status === s).length}`}</Chip>)}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item or SKU" className={`${field} lg:w-64`} />
      </div>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-[var(--bn-admin-border)] text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--bn-admin-muted)]">
            <tr><th className="px-4 py-3">Item</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Unit cost</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-right">Margin</th><th className="px-4 py-3 text-right">Value at cost</th><th className="px-4 py-3 text-right">Sold, 30 days</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--bn-admin-border)] last:border-0">
                <td className="px-4 py-3"><p className="font-semibold">{r.name}</p>{r.sku && <p className="text-xs text-[var(--bn-admin-muted)]">{r.sku}</p>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.quantity}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.costPrice === null ? <span className="text-[var(--bn-admin-muted)]">not set</span> : money(r.costPrice)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.price)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.marginPct === null ? "" : `${r.marginPct}%`}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(r.costValue)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.sold30d}</td>
                <td className="px-4 py-3"><Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-[var(--bn-admin-muted)]">{data.rows.length === 0 ? "No stock tracked yet. Turn on inventory for a product to see it here." : "No items match."}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--bn-admin-muted)]">Valued at the cost price on each product. Products with variants are not included yet.</p>
    </div>
  );
}
