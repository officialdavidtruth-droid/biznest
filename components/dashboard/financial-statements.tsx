"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, Printer } from "lucide-react";
import { getFinancialStatements, type FinancialStatements } from "@/lib/actions/financial-reports";
import { formatMoney } from "@/lib/utils/format-money";
import { toCsv } from "@/lib/financial/statements";
import { Badge, Chip, Stat, btnGhost, card, download, field } from "@/components/dashboard/fin-ui";

type View = "pl" | "bs" | "cf" | "tb";
const VIEWS: { id: View; label: string }[] = [
  { id: "pl", label: "Profit & Loss" }, { id: "bs", label: "Balance sheet" }, { id: "cf", label: "Cash flow" }, { id: "tb", label: "Trial balance" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
function preset(id: string): { from: string; to: string } {
  const n = new Date();
  const y = n.getUTCFullYear(), m = n.getUTCMonth();
  const day = (yy: number, mm: number, dd: number) => iso(new Date(Date.UTC(yy, mm, dd)));
  switch (id) {
    case "last": return { from: day(y, m - 1, 1), to: day(y, m, 0) };
    case "quarter": { const q = Math.floor(m / 3) * 3; return { from: day(y, q, 1), to: day(y, q + 3, 0) }; }
    case "year": return { from: day(y, 0, 1), to: day(y, 11, 31) };
    case "lastyear": return { from: day(y - 1, 0, 1), to: day(y - 1, 11, 31) };
    default: return { from: day(y, m, 1), to: day(y, m + 1, 0) };
  }
}
const PRESETS = [["month", "This month"], ["last", "Last month"], ["quarter", "This quarter"], ["year", "This year"], ["lastyear", "Last year"]] as const;

export function FinancialStatementsPanel({ slug }: { slug: string }) {
  const [range, setRange] = useState(preset("month"));
  const [active, setActive] = useState<string>("month");
  const [view, setView] = useState<View>("pl");
  const [compare, setCompare] = useState(true);
  const [data, setData] = useState<FinancialStatements | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, start] = useTransition();

  useEffect(() => {
    start(async () => {
      const res = await getFinancialStatements(slug, range.from, range.to);
      if (res.success) { setData(res.data); setError(null); } else setError(res.error);
    });
  }, [slug, range.from, range.to]);

  const money = (n: number) => formatMoney(n, data?.currency);
  const change = (now: number, before: number) => (before === 0 ? (now === 0 ? "" : "new") : `${now >= before ? "+" : ""}${(((now - before) / Math.abs(before)) * 100).toFixed(0)}%`);

  const csv = useMemo(() => {
    if (!data) return () => "";
    return () => {
      const rows: (string | number | null)[][] = [[data.storeName], [`${view === "bs" || view === "tb" ? "As at" : "Period"}`, view === "bs" || view === "tb" ? range.to : `${range.from} to ${range.to}`], []];
      if (view === "pl") {
        rows.push(["Account", "Amount", "Previous period"]);
        const sect = (title: string, r: typeof data.pl.revenue) => { rows.push([title]); r.forEach((x) => rows.push([`${x.code} ${x.name}`, x.amount, x.prior])); };
        sect("Revenue", data.pl.revenue); rows.push(["Total revenue", data.pl.totals.revenue, data.pl.prior.revenue]);
        sect("Cost of sales", data.pl.costOfSales); rows.push(["Gross profit", data.pl.totals.grossProfit, data.pl.prior.grossProfit]);
        sect("Operating expenses", data.pl.expenses); rows.push(["Total expenses", data.pl.totals.expenses, data.pl.prior.expenses]);
        rows.push(["Net profit", data.pl.totals.netProfit, data.pl.prior.netProfit]);
      } else if (view === "bs") {
        rows.push(["Account", "Amount"]);
        rows.push(["Assets"]); data.bs.assets.forEach((x) => rows.push([`${x.code} ${x.name}`, x.amount])); rows.push(["Total assets", data.bs.totals.assets]);
        rows.push(["Liabilities"]); data.bs.liabilities.forEach((x) => rows.push([`${x.code} ${x.name}`, x.amount])); rows.push(["Total liabilities", data.bs.totals.liabilities]);
        rows.push(["Equity"]); data.bs.equity.forEach((x) => rows.push([`${x.code} ${x.name}`, x.amount])); rows.push(["Profit not yet closed to equity", data.bs.currentEarnings]);
        rows.push(["Total equity", data.bs.totals.equity], ["Liabilities and equity", data.bs.totals.liabilitiesAndEquity]);
      } else if (view === "cf") {
        rows.push(["Item", "Amount"], ["Opening cash", data.cf.openingCash]);
        [["Operating", data.cf.operating, data.cf.totals.operating], ["Investing", data.cf.investing, data.cf.totals.investing], ["Financing", data.cf.financing, data.cf.totals.financing]].forEach(([t, r, tot]) => {
          rows.push([t as string]); (r as typeof data.cf.operating).forEach((x) => rows.push([x.name, x.amount])); rows.push([`Net ${t as string}`, tot as number]);
        });
        rows.push(["Net change in cash", data.cf.totals.net], ["Closing cash", data.cf.closingCash]);
      } else {
        rows.push(["Code", "Account", "Type", "Debit", "Credit"]);
        data.tb.rows.forEach((x) => rows.push([x.code, x.name, x.type, x.debit || null, x.credit || null]));
        rows.push(["", "Total", "", data.tb.totals.debit, data.tb.totals.credit]);
      }
      return toCsv(rows);
    };
  }, [data, view, range]);

  const Row = ({ label, now, before, bold, indent, good }: { label: string; now: number; before?: number; bold?: boolean; indent?: boolean; good?: boolean }) => (
    <tr className={`border-b border-[var(--bn-admin-border)] last:border-0 ${bold ? "bg-[color-mix(in_srgb,var(--bn-admin-surface-2)_60%,transparent)] font-bold" : ""}`}>
      <td className={`px-4 py-2.5 ${indent ? "pl-8" : ""}`}>{label}</td>
      <td className={`px-4 py-2.5 text-right tabular-nums ${good === false ? "text-rose-600" : ""}`}>{money(now)}</td>
      {compare && before !== undefined && <><td className="px-4 py-2.5 text-right tabular-nums text-[var(--bn-admin-muted)]">{money(before)}</td><td className="px-4 py-2.5 text-right text-xs text-[var(--bn-admin-muted)]">{change(now, before)}</td></>}
    </tr>
  );
  const Head = ({ cols }: { cols: string[] }) => (
    <thead className="border-b border-[var(--bn-admin-border)] text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--bn-admin-muted)]">
      <tr>{cols.map((c, i) => <th key={c + i} className={`px-4 py-3 ${i > 0 ? "text-right" : ""}`}>{c}</th>)}</tr>
    </thead>
  );
  const Section = ({ title }: { title: string }) => <tr><td colSpan={4} className="bg-[var(--bn-admin-surface-2)]/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--bn-admin-muted)]">{title}</td></tr>;

  const pl = data?.pl;
  const asAt = new Date(range.to).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="flex flex-col gap-3 print:hidden lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([id, label]) => <Chip key={id} active={active === id} onClick={() => { setActive(id); setRange(preset(id)); }}>{label}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={range.from} max={range.to} onChange={(e) => { setActive("custom"); setRange((r) => ({ ...r, from: e.target.value })); }} className={`${field} w-auto`} aria-label="From" />
          <span className="text-xs text-[var(--bn-admin-muted)]">to</span>
          <input type="date" value={range.to} min={range.from} onChange={(e) => { setActive("custom"); setRange((r) => ({ ...r, to: e.target.value })); }} className={`${field} w-auto`} aria-label="To" />
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {data && pl && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
            <Stat label="Revenue" value={money(pl.totals.revenue)} sub={compare ? `${change(pl.totals.revenue, pl.prior.revenue) || "No change"} vs previous period` : undefined} />
            <Stat label="Gross profit" value={money(pl.totals.grossProfit)} sub={`${pl.margins.gross}% gross margin`} />
            <Stat label="Net profit" value={money(pl.totals.netProfit)} sub={`${pl.margins.net}% net margin`} tone={pl.totals.netProfit >= 0 ? "good" : "bad"} />
            <Stat label="Cash at end of period" value={money(data.cf.closingCash)} sub={`${data.cf.totals.net >= 0 ? "Up" : "Down"} ${money(Math.abs(data.cf.totals.net))} in the period`} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex flex-wrap gap-2">{VIEWS.map((v) => <Chip key={v.id} active={view === v.id} onClick={() => setView(v.id)}>{v.label}</Chip>)}</div>
            <div className="flex flex-wrap items-center gap-2">
              {view === "pl" && <label className="flex items-center gap-2 text-xs font-bold text-[var(--bn-admin-muted)]"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare with previous period</label>}
              <button className={btnGhost} onClick={() => download(`${view}-${range.from}-${range.to}.csv`, csv())}><Download className="h-3.5 w-3.5" /> Excel / CSV</button>
              <button className={btnGhost} onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Print</button>
            </div>
          </div>

          <div className={`${card} overflow-hidden ${loading ? "opacity-60" : ""}`}>
            <div className="border-b border-[var(--bn-admin-border)] px-4 py-4">
              <h3 className="font-bold">{VIEWS.find((v) => v.id === view)?.label}</h3>
              <p className="text-xs text-[var(--bn-admin-muted)]">{data.storeName} · {view === "bs" || view === "tb" ? `As at ${asAt}` : `${new Date(range.from).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} to ${asAt}`}</p>
            </div>

            {view === "pl" && (
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
                <Head cols={compare ? ["", "This period", "Previous", "Change"] : ["", "This period"]} />
                <tbody>
                  <Section title="Revenue" />
                  {pl.revenue.map((r) => <Row key={r.id} indent label={`${r.name}`} now={r.amount} before={r.prior} />)}
                  <Row bold label="Total revenue" now={pl.totals.revenue} before={pl.prior.revenue} />
                  <Section title="Cost of sales" />
                  {pl.costOfSales.map((r) => <Row key={r.id} indent label={r.name} now={r.amount} before={r.prior} />)}
                  <Row bold label="Gross profit" now={pl.totals.grossProfit} before={pl.prior.grossProfit} good={pl.totals.grossProfit >= 0} />
                  <Section title="Operating expenses" />
                  {pl.expenses.map((r) => <Row key={r.id} indent label={r.name} now={r.amount} before={r.prior} />)}
                  <Row bold label="Total expenses" now={pl.totals.expenses} before={pl.prior.expenses} />
                  <Row bold label="Net profit" now={pl.totals.netProfit} before={pl.prior.netProfit} good={pl.totals.netProfit >= 0} />
                </tbody>
              </table>
              {pl.revenue.length + pl.expenses.length + pl.costOfSales.length === 0 && <p className="px-4 py-10 text-center text-sm text-[var(--bn-admin-muted)]">Nothing has been posted in this period yet. Orders, expenses and journals show up here once posted.</p>}
              </div>
            )}

            {view === "bs" && (
              <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
                <Head cols={["", "Amount"]} />
                <tbody>
                  <Section title="Assets" />{data.bs.assets.map((r) => <Row key={r.id} indent label={r.name} now={r.amount} />)}<Row bold label="Total assets" now={data.bs.totals.assets} />
                  <Section title="Liabilities" />{data.bs.liabilities.map((r) => <Row key={r.id} indent label={r.name} now={r.amount} />)}<Row bold label="Total liabilities" now={data.bs.totals.liabilities} />
                  <Section title="Equity" />{data.bs.equity.map((r) => <Row key={r.id} indent label={r.name} now={r.amount} />)}
                  <Row indent label="Profit not yet closed to equity" now={data.bs.currentEarnings} />
                  <Row bold label="Total equity" now={data.bs.totals.equity} />
                  <Row bold label="Liabilities + equity" now={data.bs.totals.liabilitiesAndEquity} />
                </tbody>
              </table>
              <div className="border-t border-[var(--bn-admin-border)] px-4 py-3">{data.bs.balanced ? <Badge tone="green">Balanced: assets equal liabilities plus equity</Badge> : <Badge tone="red">Out of balance by {money(Math.abs(data.bs.difference))}. Check for one-sided journals.</Badge>}</div>
              </div>
            )}

            {view === "cf" && (
              <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
                <Head cols={["", "Amount"]} />
                <tbody>
                  <Row bold label="Opening cash and bank" now={data.cf.openingCash} />
                  <Section title="Operating activities" />{data.cf.operating.map((r) => <Row key={r.name} indent label={r.name} now={r.amount} good={r.amount >= 0} />)}<Row bold label="Net from operations" now={data.cf.totals.operating} good={data.cf.totals.operating >= 0} />
                  <Section title="Investing activities" />{data.cf.investing.map((r) => <Row key={r.name} indent label={r.name} now={r.amount} good={r.amount >= 0} />)}<Row bold label="Net from investing" now={data.cf.totals.investing} good={data.cf.totals.investing >= 0} />
                  <Section title="Financing activities" />{data.cf.financing.map((r) => <Row key={r.name} indent label={r.name} now={r.amount} good={r.amount >= 0} />)}<Row bold label="Net from financing" now={data.cf.totals.financing} good={data.cf.totals.financing >= 0} />
                  <Row bold label="Net change in cash" now={data.cf.totals.net} good={data.cf.totals.net >= 0} />
                  <Row bold label="Closing cash and bank" now={data.cf.closingCash} />
                </tbody>
              </table>
              {data.entriesTruncated && <p className="px-4 py-3 text-xs text-amber-700">This period has a very large number of cash entries; the cash flow covers the first 5,000. Choose a shorter range for the full picture.</p>}
              </div>
            )}

            {view === "tb" && (
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
                <thead className="border-b border-[var(--bn-admin-border)] text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--bn-admin-muted)]"><tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th></tr></thead>
                <tbody>
                  {data.tb.rows.map((r) => <tr key={r.id} className="border-b border-[var(--bn-admin-border)] last:border-0"><td className="px-4 py-2.5"><span className="text-[var(--bn-admin-muted)]">{r.code}</span> {r.name}</td><td className="px-4 py-2.5 text-xs text-[var(--bn-admin-muted)]">{r.type.toLowerCase()}</td><td className="px-4 py-2.5 text-right tabular-nums">{r.debit ? money(r.debit) : ""}</td><td className="px-4 py-2.5 text-right tabular-nums">{r.credit ? money(r.credit) : ""}</td></tr>)}
                  <tr className="bg-[var(--bn-admin-surface-2)]/60 font-bold"><td className="px-4 py-3" colSpan={2}>Totals</td><td className="px-4 py-3 text-right tabular-nums">{money(data.tb.totals.debit)}</td><td className="px-4 py-3 text-right tabular-nums">{money(data.tb.totals.credit)}</td></tr>
                </tbody>
              </table>
              <div className="border-t border-[var(--bn-admin-border)] px-4 py-3">{data.tb.balanced ? <Badge tone="green">Debits equal credits</Badge> : <Badge tone="red">Debits and credits differ. The books need a correcting journal.</Badge>}</div>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
            <Stat label="Current ratio" value={data.ratios.currentRatio === null ? "n/a" : `${data.ratios.currentRatio}x`} sub="Short-term assets per 1 owed" />
            <Stat label="Quick ratio" value={data.ratios.quickRatio === null ? "n/a" : `${data.ratios.quickRatio}x`} sub="Same, without stock" />
            <Stat label="Stock turnover" value={data.ratios.stockTurnover === null ? "n/a" : `${data.ratios.stockTurnover}x`} sub="Cost of sales ÷ stock at cost" />
            <Stat label="Days of stock" value={data.ratios.daysOfStock === null ? "n/a" : String(data.ratios.daysOfStock)} sub="At the current rate of sales" />
          </div>
        </>
      )}
      {!data && !error && <div className={`${card} px-4 py-16 text-center text-sm text-[var(--bn-admin-muted)]`}>Preparing your statements…</div>}
    </div>
  );
}
