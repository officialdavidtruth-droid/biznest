import { prisma } from "@/lib/prisma";
import { SELLER_VISIBLE_ORDER_STATUSES } from "@/lib/actions/order";

const PAID_STATUSES = ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] as const;

export default async function AnalyticsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const since = new Date();
  since.setDate(since.getDate() - 29);

  const orders = await prisma.order.findMany({
    where: { storeId: store.id, status: { in: [...PAID_STATUSES] }, createdAt: { gte: since } },
    select: { total: true, createdAt: true },
  });

  // Bucket by day for a simple 30-day bar chart — no charting library needed.
  const days: { label: string; total: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const total = orders
      .filter((o) => o.createdAt.toDateString() === key)
      .reduce((s, o) => s + Number(o.total), 0);
    days.push({ label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }), total });
  }
  const max = Math.max(1, ...days.map((d) => d.total));
  const revenue30 = days.reduce((s, d) => s + d.total, 0);

  // "All-time orders" only counts orders that were actually paid for —
  // never a checkout that was started but abandoned or failed.
  const [productCount, viewsProxy] = await Promise.all([
    prisma.product.count({ where: { storeId: store.id, isPublished: true } }),
    prisma.order.count({ where: { storeId: store.id, status: { in: SELLER_VISIBLE_ORDER_STATUSES } } }),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Analytics</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs uppercase text-muted-foreground">Revenue (30 days)</p>
          <p className="mt-1 text-2xl font-semibold">₦{revenue30.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs uppercase text-muted-foreground">Live listings</p>
          <p className="mt-1 text-2xl font-semibold">{productCount}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs uppercase text-muted-foreground">All-time orders</p>
          <p className="mt-1 text-2xl font-semibold">{viewsProxy}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-background p-4">
        <p className="mb-4 text-sm font-medium">Daily revenue, last 30 days</p>
        <div className="flex h-40 items-end gap-1">
          {days.map((d, i) => (
            <div key={i} className="group relative flex-1">
              <div
                className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
                style={{ height: `${Math.max(2, (d.total / max) * 100)}%` }}
              />
              <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-[10px] text-background group-hover:block">
                {d.label}: ₦{d.total.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
