import Link from "next/link";
import { listOrders } from "@/lib/actions/order";

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-yellow-100 text-yellow-700",
  PAID: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-200 text-gray-700",
  REFUNDED: "bg-gray-200 text-gray-700",
  DISPUTED: "bg-destructive/10 text-destructive",
};

export default async function StoreOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const orders = await listOrders(slug);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Orders</h1>

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Items</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-mono text-xs">#{order.id.slice(-8).toUpperCase()}</td>
                <td className="px-4 py-3">
                  {order.channel === "POS" ? (order.posCustomerName ?? "Walk-in customer") : (order.buyer.name ?? order.buyer.email)}
                  {order.channel === "POS" && (
                    <span className="ml-1.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">POS</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{order.items.length}</td>
                <td className="px-4 py-3">{order.currency} {Number(order.total).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[order.status]}`}>
                    {order.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/${slug}/admin/orders/${order.id}`} className="text-xs font-medium text-primary hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
