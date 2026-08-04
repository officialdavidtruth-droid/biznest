import { listOrdersForBuyer } from "@/lib/actions/order";
import Link from "next/link";

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

export default async function BuyerOrdersPage() {
  const orders = await listOrdersForBuyer();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">My orders</h1>

      {orders.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          You haven't placed any orders yet.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/store/${order.store.slug}/orders/${order.id}/confirmation`}
              className="block rounded-lg border p-4 transition hover:border-primary/40"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{order.store.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Order #{order.id.slice(-8).toUpperCase()} · {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[order.status]}`}>
                  {order.status.replace("_", " ")}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                </span>
                <span className="font-medium">
                  {order.currency} {Number(order.total).toLocaleString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
