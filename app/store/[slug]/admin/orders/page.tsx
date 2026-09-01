// Route: /store/[slug]/admin/orders
import { listOrders } from "@/lib/actions/order";
import { OrdersTable } from "@/components/dashboard/orders-table";
import { ShoppingBag, Clock3, CheckCircle2, Banknote } from "lucide-react";
import { StatCard } from "@/components/dashboard/list-toolbar";

export default async function StoreOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const orders = await listOrders(slug);

  const pendingCount = orders.filter((o) => o.status === "PENDING_PAYMENT" || o.status === "IN_PROGRESS").length;
  const completedCount = orders.filter((o) => o.status === "COMPLETED" || o.status === "DELIVERED").length;
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const currency = orders[0]?.currency ?? "";

  return (
    <div className="bn-admin-page space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage and track every order placed on your store</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ShoppingBag} tone="purple" label="Total Orders" value={orders.length} note="All time" />
        <StatCard icon={Clock3} tone="orange" label="Pending" value={pendingCount} note="Awaiting action" />
        <StatCard icon={CheckCircle2} tone="green" label="Completed" value={completedCount} note="Fulfilled orders" />
        <StatCard icon={Banknote} tone="blue" label="Revenue" value={`${currency} ${totalRevenue.toLocaleString()}`} note="From all orders" />
      </div>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4"><h2 className="text-base font-bold">Orders</h2><p className="mt-1 text-xs text-muted-foreground">Search, filter and manage every order</p></div>
        <OrdersTable
          storeSlug={slug}
          orders={orders.map((order) => ({
            id: order.id,
            customerName: order.channel === "POS" ? (order.posCustomerName ?? "Walk-in customer") : (order.buyer.name ?? order.buyer.email),
            channel: order.channel,
            itemCount: order.items.length,
            total: Number(order.total),
            currency: order.currency,
            status: order.status,
            createdAt: order.createdAt.toString(),
          }))}
        />
      </section>
    </div>
  );
}
