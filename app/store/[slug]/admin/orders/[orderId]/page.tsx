// Route: /store/[slug]/admin/orders/[orderId]
import { getOrder } from "@/lib/actions/order";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { OrderStatusControl } from "@/components/dashboard/order-status-control";
import { RefundControl } from "@/components/dashboard/refund-control";
import { DISPUTE_STATUS_CONFIG } from "@/lib/constants/dispute";

const REFUNDABLE_STATUSES = ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"];

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
      <h1 className="mb-1 text-xl font-semibold">
        Order #{order.id.slice(-8).toUpperCase()}
        {order.channel === "POS" && (
          <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 align-middle text-xs font-medium text-purple-700">
            POS · {order.posTenderType}
          </span>
        )}
      </h1>
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
        {order.channel === "POS" ? (
          <>
            <p className="text-sm">{order.posCustomerName ?? "Walk-in customer"}</p>
            {order.posCustomerPhone && <p className="text-sm text-muted-foreground">{order.posCustomerPhone}</p>}
          </>
        ) : (
          <>
            <p className="text-sm">{order.buyer.name ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{order.buyer.email}</p>
          </>
        )}
        {address && (
          <div className="mt-3 border-t pt-3 text-sm">
            <p>{address.fullName} · {address.phone}</p>
            <p className="text-muted-foreground">
              {address.address}, {address.city}, {address.state}, {address.country}
            </p>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-lg border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold">Status</h2>
        <OrderStatusControl storeSlug={slug} orderId={order.id} currentStatus={order.status} />
      </div>

      {order.dispute && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-red-900">
              <ShieldAlert className="h-4 w-4" />
              Dispute
            </h2>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${DISPUTE_STATUS_CONFIG[order.dispute.status].bg} ${DISPUTE_STATUS_CONFIG[order.dispute.status].text} ${DISPUTE_STATUS_CONFIG[order.dispute.status].ring}`}
            >
              {DISPUTE_STATUS_CONFIG[order.dispute.status].label}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-red-800">
            The buyer has opened a dispute on this order. Head to the Resolution Center to review evidence and respond.
          </p>
          <Link
            href={`/disputes/${order.id}`}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-red-700 hover:text-red-900"
          >
            Open dispute thread →
          </Link>
        </div>
      )}

      {REFUNDABLE_STATUSES.includes(order.status) && (
        <div className="rounded-lg border bg-background p-4">
          <h2 className="mb-3 text-sm font-semibold">Refund</h2>
          <RefundControl storeSlug={slug} orderId={order.id} />
        </div>
      )}
    </div>
  );
        }
