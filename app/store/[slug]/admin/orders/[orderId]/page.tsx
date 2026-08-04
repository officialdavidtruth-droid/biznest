import { getOrder } from "@/lib/actions/order";
import { notFound } from "next/navigation";
import { OrderStatusControl } from "@/components/dashboard/order-status-control";

export default async function StoreOrderDetailPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const order = await getOrder(slug, orderId);
  if (!order) notFound();

  const address = order.shippingAddress as {
    fullName: string; phone: string; address: string; city: string; state: string; country: string;
  } | null;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">Order #{order.id.slice(-8).toUpperCase()}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Placed {new Date(order.createdAt).toLocaleString()}
      </p>

      <div className="mb-6 rounded-lg border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold">Items</h2>
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between py-1 text-sm">
            <span>{item.product?.name ?? item.service?.name} × {item.quantity}</span>
            <span>{order.currency} {(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t pt-2 text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{order.currency} {Number(order.subtotal).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Platform commission</span>
          <span>-{order.currency} {Number(order.commission).toLocaleString()}</span>
        </div>
        <div className="mt-1 flex justify-between border-t pt-2 font-medium">
          <span>Total</span>
          <span>{order.currency} {Number(order.total).toLocaleString()}</span>
        </div>
      </div>

      <div className="mb-6 rounded-lg border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold">Customer</h2>
        <p className="text-sm">{order.buyer.name ?? "—"}</p>
        <p className="text-sm text-muted-foreground">{order.buyer.email}</p>
        {address && (
          <div className="mt-3 border-t pt-3 text-sm">
            <p>{address.fullName} · {address.phone}</p>
            <p className="text-muted-foreground">
              {address.address}, {address.city}, {address.state}, {address.country}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold">Status</h2>
        <OrderStatusControl storeSlug={slug} orderId={order.id} currentStatus={order.status} />
      </div>
    </div>
  );
}
