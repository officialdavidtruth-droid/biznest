import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BarChart3, Minus } from "lucide-react";
import type { AdvancedAnalytics } from "@/lib/actions/analytics-report";
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

export function AdvancedAnalyticsWorkspace({ slug, rangeDays, data, money }: { slug: string; rangeDays: number; data: AdvancedAnalytics; money: (v: number) => string }) {
  const { current, currentTotals: now, previousTotals: prev, lowStock } = data;
  const hasAnyData = now.orders > 0 || now.visitors > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">BizNest App</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><BarChart3 className="h-5 w-5 text-primary" /> Advanced Analytics</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">How the last {rangeDays} days compare with the {rangeDays} days before, plus stock risk. Charts, best sellers, traffic and profit are on the main Analytics page.</p>
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
      </div>

      <div className="grid gap-4">
        <div className="rounded-2xl border bg-background p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold">Stock risk</p>
          {lowStock.length === 0 ? <p className="text-xs text-muted-foreground">Nothing is at or below its reorder level.</p> : <ul className="space-y-2">{lowStock.map((i) => <li key={i.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{i.name}</span><span className={`shrink-0 text-xs font-semibold ${i.quantity === 0 ? "text-red-600" : "text-amber-600"}`}>{i.quantity === 0 ? "Out of stock" : `${i.quantity} left`} <span className="font-normal text-muted-foreground">(reorder at {i.threshold})</span></span></li>)}</ul>}
          <Link href={`/store/${slug}/admin/inventory`} className="mt-3 inline-block text-xs font-semibold text-primary">Manage inventory</Link>
        </div>
      </div>
    </div>
  );
}
