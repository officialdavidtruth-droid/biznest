import { prisma } from "@/lib/prisma";
import { SELLER_VISIBLE_ORDER_STATUSES } from "@/lib/actions/order";

export default async function CustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  // Only orders that were actually paid for count toward a customer's
  // order count / total spent — an abandoned or failed checkout was never
  // real money changing hands and shouldn't inflate these numbers.
  const orders = await prisma.order.findMany({
    where: { storeId: store.id, status: { in: SELLER_VISIBLE_ORDER_STATUSES } },
    include: { buyer: true },
    orderBy: { createdAt: "desc" },
  });

  const byCustomer = new Map<string, { name: string; email: string; orders: number; spent: number; last: Date }>();
  for (const o of orders) {
    const key = o.buyerId;
    const existing = byCustomer.get(key);
    const spent = Number(o.total);
    if (existing) {
      existing.orders += 1;
      existing.spent += spent;
      if (o.createdAt > existing.last) existing.last = o.createdAt;
    } else {
      byCustomer.set(key, {
        name: o.buyer.name ?? "Unnamed",
        email: o.buyer.email,
        orders: 1,
        spent,
        last: o.createdAt,
      });
    }
  }
  const customers = [...byCustomer.values()].sort((a, b) => b.spent - a.spent);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Customers</h1>
        <span className="text-xs text-muted-foreground">{customers.length} customers</span>
      </div>
      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Customer</th><th className="px-4 py-2">Orders</th><th className="px-4 py-2">Total spent</th><th className="px-4 py-2">Last order</th></tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.email} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.email}</p>
                </td>
                <td className="px-4 py-3">{c.orders}</td>
                <td className="px-4 py-3">₦{c.spent.toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.last.toLocaleDateString()}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No customers yet — they'll appear here after your first order.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
