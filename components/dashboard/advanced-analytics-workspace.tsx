import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BarChart3, Minus } from "lucide-react";
import type { AdvancedAnalytics, DailyPoint } from "@/lib/actions/analytics-report";
import { formatNumber } from "@/lib/i18n/locale";

const RANGES = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
] as const;

function change(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-[11px] text-muted-foreground">No previous data</span>;
  if (pct === 0) return <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><Minus className="h-3 w-3" /> No change</span>;
  const up = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? "text-emerald-600" : "text-red-600"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct)}% <span className="font-normal text-muted-foreground">vs previous</span>
    </span>
  );
}

function Kpi({ label, value, pct, sub }: { label: string; value: string; pct?: number | null; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-background p-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <div className="mt-1 min-h-[16px]">{pct !== undefined ? <Delta pct={pct} /> : sub ? <span className="text-[11px] text-muted-foreground">{sub}</span> : null}</div>
    </div>
  );
}

function BarChart({ title, series, field, format }: { title: string; series: DailyPoint[]; field: "revenue" | "orders" | "visitors" | "conversionRate"; format: (v: number) => string }) {
  const values = series.map((d) => d[field] ?? 0);
  const max = Math.max(1, ...values);
  return (
    <div className="rounded-2xl border bg-background p-4 shadow-sm">
      <p className="mb-4 text-sm font-semibold">{title}</p>
      <div className="flex h-32 items-end gap-[2px]">
        {series.map((d, i) => {
          const v = d[field] ?? 0;
          return (
            <div key={i} className="group relative flex h-full flex-1 items-end">
              <div className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary" style={{ height: `${Math.max(2, (v / max) * 100)}%` }} />
              <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-[10px] text-background group-hover:block">{d.label}: {format(v)}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>{series[0]?.label}</span><span>{series[series.length - 1]?.label}</span></div>
    </div>
  );
}

export function AdvancedAnalyticsWorkspace({ slug, rangeDays, data, money }: { slug: string; rangeDays: number; data: AdvancedAnalytics; money: (v: number) => string }) {
  const { current, currentTotals: now, previousTotals: prev, lowStock } = data;
  const summary = current.summary;
  const hasAnyData = now.orders > 0 || now.visitors > 0;
  const totalVisits = Math.max(1, current.trafficSources.reduce((s, t) => s + t.visits, 0));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">BizNest App</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><BarChart3 className="h-5 w-5 text-primary" /> Advanced Analytics</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Revenue, demand, conversion and stock risk, compared with the previous {rangeDays} days.</p>
        </div>
        <div className="flex gap-1 rounded-lg border p-1">
          {RANGES.map((r) => (
            <Link key={r.value} href={`/store/${slug}/admin/apps/advanced-analytics?range=${r.value}`} className={`rounded-md px-3 py-1 text-xs font-medium ${rangeDays === r.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{r.label}</Link>
          ))}
        </div>
      </div>

      {!hasAnyData && <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No paid orders or store visits in the last {rangeDays} days yet. Numbers appear here as soon as customers start visiting and buying.</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Revenue" value={money(now.revenue)} pct={change(now.revenue, prev.revenue)} />
        <Kpi label="Orders" value={formatNumber(now.orders)} pct={change(now.orders, prev.orders)} />
        <Kpi label="Average order value" value={now.averageOrderValue != null ? money(now.averageOrderValue) : "—"} pct={change(now.averageOrderValue, prev.averageOrderValue)} />
        <Kpi label="Conversion rate" value={now.conversionRate != null ? `${now.conversionRate}%` : "—"} pct={change(now.conversionRate, prev.conversionRate)} />
        <Kpi label="Visitors" value={formatNumber(now.visitors)} pct={change(now.visitors, prev.visitors)} />
        <Kpi label="Customers" value={formatNumber(summary.customers)} sub="Distinct buyers in range" />
        <Kpi label="Returning customers" value={current.returningCustomerRate != null ? `${current.returningCustomerRate}%` : "—"} sub={current.returningCustomerRate == null ? "Needs at least 5 orders" : "Ordered more than once"} />
        <Kpi label="Abandoned checkouts" value={formatNumber(summary.abandonedCarts)} sub="Started, never paid" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart title="Revenue" series={current.series} field="revenue" format={money} />
        <BarChart title="Orders" series={current.series} field="orders" format={(v) => `${v}`} />
        <BarChart title="Visitors" series={current.series} field="visitors" format={(v) => `${v}`} />
        <BarChart title="Conversion rate" series={current.series} field="conversionRate" format={(v) => `${v}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-background p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold">Best products</p>
          {current.bestProducts.length === 0 ? <p className="text-xs text-muted-foreground">No sales in this range yet.</p> : <ul className="space-y-2">{current.bestProducts.map((p) => <li key={p.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{p.name}</span><span className="shrink-0 text-xs text-muted-foreground">{p.unitsSold} sold · {money(p.revenue)}</span></li>)}</ul>}
        </div>
        <div className="rounded-2xl border bg-background p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold">Best categories</p>
          {current.bestCategories.length === 0 ? <p className="text-xs text-muted-foreground">No sales in this range yet.</p> : <ul className="space-y-2">{current.bestCategories.map((c) => <li key={c.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{c.name}</span><span className="shrink-0 text-xs text-muted-foreground">{c.unitsSold} sold · {money(c.revenue)}</span></li>)}</ul>}
        </div>
        <div className="rounded-2xl border bg-background p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold">Traffic sources</p>
          {current.trafficSources.length === 0 ? <p className="text-xs text-muted-foreground">No visits recorded in this range yet.</p> : <div className="space-y-2">{current.trafficSources.map((t) => <div key={t.source} className="flex items-center gap-3 text-sm"><span className="w-20 shrink-0 text-muted-foreground">{t.source}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${(t.visits / totalVisits) * 100}%` }} /></div><span className="w-14 shrink-0 text-right text-xs text-muted-foreground">{formatNumber(t.visits)}</span></div>)}</div>}
        </div>
        <div className="rounded-2xl border bg-background p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold">Stock risk</p>
          {lowStock.length === 0 ? <p className="text-xs text-muted-foreground">Nothing is at or below its reorder level.</p> : <ul className="space-y-2">{lowStock.map((i) => <li key={i.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{i.name}</span><span className={`shrink-0 text-xs font-semibold ${i.quantity === 0 ? "text-red-600" : "text-amber-600"}`}>{i.quantity === 0 ? "Out of stock" : `${i.quantity} left`} <span className="font-normal text-muted-foreground">(reorder at {i.threshold})</span></span></li>)}</ul>}
          <Link href={`/store/${slug}/admin/inventory`} className="mt-3 inline-block text-xs font-semibold text-primary">Manage inventory</Link>
        </div>
      </div>

      <div className="rounded-2xl border bg-background p-4 shadow-sm">
        <p className="mb-1 text-sm font-semibold">Profit</p>
        {current.profit ? (
          <><p className="text-2xl font-bold">{money(current.profit.amount)}</p><p className="mt-0.5 text-xs text-muted-foreground">Based on {current.profit.coveragePct}% of revenue, counting only items with a cost price set. <Link href={`/store/${slug}/admin/inventory`} className="underline">Add cost prices</Link> to widen this.</p></>
        ) : (
          <p className="text-xs text-muted-foreground">No cost prices are set yet, so profit can&apos;t be calculated. <Link href={`/store/${slug}/admin/inventory`} className="underline">Add cost prices in Inventory</Link>.</p>
        )}
      </div>
    </div>
  );
}
