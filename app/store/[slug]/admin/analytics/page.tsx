import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getStoreAnalytics, type DailyPoint } from "@/lib/actions/analytics-report";

const RANGES = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
] as const;

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// Simple no-library bar chart, same technique the old single-metric chart
// used -- picks a numeric field off each DailyPoint and renders relative
// bar heights with a hover tooltip. Kept generic so every requested metric
// (revenue, orders, visitors, conversion) reuses one implementation.
function DailyBarChart({
  title,
  series,
  field,
  format,
}: {
  title: string;
  series: DailyPoint[];
  field: "revenue" | "orders" | "visitors" | "conversionRate";
  format: (v: number) => string;
}) {
  const values = series.map((d) => d[field] ?? 0);
  const max = Math.max(1, ...values);
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="mb-4 text-sm font-medium">{title}</p>
      <div className="flex h-32 items-end gap-1">
        {series.map((d, i) => {
          const v = d[field] ?? 0;
          return (
            <div key={i} className="group relative flex-1">
              <div
                className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
                style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
              />
              <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-[10px] text-background group-hover:block">
                {d.label}: {format(v)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { slug } = await params;
  const { range } = await searchParams;
  const rangeDays = RANGES.some((r) => String(r.value) === range) ? Number(range) : 30;

  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const data = await getStoreAnalytics(store.id, rangeDays);
  const { summary } = data;

  const currency = "₦"; // stores are NGN-first; see Order.currency default

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <div className="flex gap-1 rounded-lg border p-1">
          {RANGES.map((r) => (
            <Link
              key={r.value}
              href={`/${slug}/admin/analytics?range=${r.value}`}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                rangeDays === r.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ---------- Summary stat cards ---------- */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Revenue" value={`${currency}${summary.revenue.toLocaleString()}`} />
        <StatCard label="Orders" value={summary.orders.toLocaleString()} />
        <StatCard label="Customers" value={summary.customers.toLocaleString()} />
        <StatCard
          label="Conversion rate"
          value={summary.conversionRate != null ? `${summary.conversionRate}%` : "—"}
          sub={summary.conversionRate == null ? "Needs more visitor data" : undefined}
        />
        <StatCard
          label="Average order value"
          value={summary.averageOrderValue != null ? `${currency}${summary.averageOrderValue.toLocaleString()}` : "—"}
        />
      </div>

      {/* ---------- Graphs ---------- */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <DailyBarChart title="Revenue" series={data.series} field="revenue" format={(v) => `${currency}${v.toLocaleString()}`} />
        <DailyBarChart title="Orders" series={data.series} field="orders" format={(v) => `${v}`} />
        <DailyBarChart title="Visitors" series={data.series} field="visitors" format={(v) => `${v}`} />
        <DailyBarChart
          title="Conversion"
          series={data.series}
          field="conversionRate"
          format={(v) => `${v}%`}
        />
      </div>

      {/* ---------- Abandoned carts + returning customers ---------- */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs uppercase text-muted-foreground">Abandoned carts</p>
          <p className="mt-1 text-2xl font-semibold">{summary.abandonedCarts.toLocaleString()}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Checkouts started but never paid, in the last {rangeDays} days.{" "}
            <Link href={`/${slug}/admin/orders`} className="underline">
              View orders
            </Link>
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs uppercase text-muted-foreground">Returning customers</p>
          <p className="mt-1 text-2xl font-semibold">
            {data.returningCustomerRate != null ? `${data.returningCustomerRate}%` : "—"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.returningCustomerRate == null ? "Needs at least 5 orders to be meaningful" : "of buyers have ordered more than once"}
          </p>
        </div>
      </div>

      {/* ---------- Best products / categories ---------- */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <p className="mb-3 text-sm font-medium">Best products</p>
          {data.bestProducts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sales in this range yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.bestProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{p.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.unitsSold} sold · {currency}{p.revenue.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="mb-3 text-sm font-medium">Best categories</p>
          {data.bestCategories.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sales in this range yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.bestCategories.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{c.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {c.unitsSold} sold · {currency}{c.revenue.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---------- Traffic sources ---------- */}
      <div className="mb-6 rounded-lg border bg-background p-4">
        <p className="mb-3 text-sm font-medium">Traffic sources</p>
        {data.trafficSources.length === 0 ? (
          <p className="text-xs text-muted-foreground">No visits recorded in this range yet.</p>
        ) : (
          <div className="space-y-2">
            {(() => {
              const total = Math.max(1, data.trafficSources.reduce((s, t) => s + t.visits, 0));
              return data.trafficSources.map((t) => (
                <div key={t.source} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 text-muted-foreground">{t.source}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${(t.visits / total) * 100}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{t.visits.toLocaleString()}</span>
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {/* ---------- Profit (only if any product has a cost set) ---------- */}
      <div className="rounded-lg border bg-background p-4">
        <p className="mb-1 text-sm font-medium">Profit</p>
        {data.profit ? (
          <>
            <p className="text-2xl font-semibold">{currency}{data.profit.amount.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Based on {data.profit.coveragePct}% of revenue — only items with a cost price set on their inventory
              record are included.{" "}
              <Link href={`/${slug}/admin/inventory`} className="underline">
                Add cost prices
              </Link>{" "}
              to widen this.
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            No inventory items have a cost price set yet, so profit can&apos;t be calculated.{" "}
            <Link href={`/${slug}/admin/inventory`} className="underline">
              Add cost prices in Inventory
            </Link>{" "}
            to start tracking profit here.
          </p>
        )}
      </div>

      {/* ---------- Roadmap note: CAC / LTV need a marketing-spend input we don't collect yet ---------- */}
      <p className="mt-6 text-xs text-muted-foreground">
        Customer acquisition cost and customer lifetime value need a marketing-spend input BizNest doesn&apos;t
        collect yet — they&apos;ll show up here once that&apos;s in place.
      </p>
    </div>
  );
}
