// Route: /store/[slug]/admin/orders/[orderId]
import { customerMessagingEnabled } from "@/lib/customer-messaging";
import { formatShipsOn } from "@/lib/preorder";
import { isImageProofUrl } from "@/lib/payments/manual-transfer";
import { getOrder } from "@/lib/actions/order";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Printer, ShieldAlert } from "lucide-react";
import { OrderStatusControl } from "@/components/dashboard/order-status-control";
import { RefundControl } from "@/components/dashboard/refund-control";
import { ConfirmManualPaymentButton } from "@/components/dashboard/confirm-manual-payment-button";
import { DISPUTE_STATUS_CONFIG } from "@/lib/constants/dispute";
import { formatDate, formatNumber } from "@/lib/i18n/locale";
import { whatsappLink } from "@/lib/builder-defaults";
import { prisma } from "@/lib/prisma";
import { getInHouseReservations } from "@/lib/actions/folio";
import { PostToRoomButton } from "@/components/dashboard/post-to-room-button";
import { DeliveryPanel } from "@/components/dashboard/delivery-panel";

const REFUNDABLE_STATUSES = ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"];

export default async function StoreOrderDetailPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const order = await getOrder(slug, orderId);
  if (!order) notFound();

  const subtotal = Number(order.subtotal);
  const deliveryFee = Number(order.deliveryFee ?? 0);
  const commission = Number(order.commission ?? 0);
  const total = Number(order.total);

  // Hotels: in-store (POS) sales can be charged to a checked-in guest's room.
  const isPos = order.channel === "POS";
  const rooms = isPos ? await getInHouseReservations(slug) : [];
  const roomCharge = isPos
    ? await prisma.propertyFolioCharge.findFirst({
        where: { storeId: order.storeId, sourceType: "ORDER", sourceId: order.id, status: { not: "VOID" } },
        select: { reservation: { select: { room: { select: { name: true } } } } },
      })
    : null;

  const messagesOn = customerMessagingEnabled() && !!(await prisma.store.findUnique({ where: { id: order.storeId }, select: { msgOrderUpdates: true } }))?.msgOrderUpdates;

  const address = order.shippingAddress as {
    fullName: string; phone: string; address: string; city: string; state: string; country: string;
  } | null;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">
        Order #{order.id.slice(-8).toUpperCase()}
        {order.channel === "POS" && (
          <span className="ml-2 rounded-full bg-[var(--bn-admin-surface-2)] px-2 py-0.5 align-middle text-xs font-medium text-[var(--bn-admin-orange)]">
            POS · {order.posTenderType}
          </span>
        )}
      </h1>
      <p className="mb-2 text-sm text-muted-foreground">
        Placed {formatDate(new Date(order.createdAt), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
      </p>
      <a
        href={`/receipts/${slug}/order/${order.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-6 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
      >
        <Printer className="h-3.5 w-3.5" /> Print order receipt
      </a>
      {isPos && (
        <span className="mb-6 ml-3 inline-block align-middle text-xs">
          <PostToRoomButton storeSlug={slug} kind="order" id={order.id} rooms={rooms} postedTo={roomCharge?.reservation.room.name ?? null} />
        </span>
      )}

      <div className="mb-6 rounded-lg border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold">Items</h2>
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between py-1 text-sm">
            <span>{item.product?.name ?? item.service?.name} × {item.quantity}{item.preorder && <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Pre-order{item.preorderShipsOn ? ` · ships by ${formatShipsOn(item.preorderShipsOn)}` : ""}</span>}</span>
            <span>{order.currency} {formatNumber((Number(item.unitPrice) * item.quantity))}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t pt-2 text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{order.currency} {formatNumber(subtotal)}</span>
        </div>
        {deliveryFee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery fee</span>
            <span>{order.currency} {formatNumber(deliveryFee)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t pt-2 font-medium">
          <span>{order.status === "PENDING_PAYMENT" || order.status === "CANCELLED" ? "Order total" : "Customer paid"}</span>
          <span>{order.currency} {formatNumber(total)}</span>
        </div>
        {commission > 0 && (
          <>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-muted-foreground">Platform commission</span>
              <span>-{order.currency} {formatNumber(commission)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>You keep (before payment fees)</span>
              <span>{order.currency} {formatNumber(Math.max(0, total - commission))}</span>
            </div>
          </>
        )}
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
            {(() => {
              // Click-to-chat (no WhatsApp Business API needed): opens the merchant's own WhatsApp with a ready message.
              const wa = whatsappLink(address.phone);
              if (!wa) return null;
              const text = `Hello ${address.fullName}, this is about your order #${order.id.slice(-8).toUpperCase()}.`;
              return (
                <a href={`${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  Message on WhatsApp
                </a>
              );
            })()}
            <p className="text-muted-foreground">
              {address.address}, {address.city}, {address.state}, {address.country}
            </p>
          </div>
        )}
      </div>

      {order.channel !== "POS" && order.paymentProvider === "CASH" && order.status === "PENDING_PAYMENT" && (
        <div className="mb-6 rounded-lg border border-[var(--bn-admin-border)] bg-[var(--bn-admin-surface-2)] p-4">
          <h2 className="mb-1 text-sm font-semibold">Bank transfer: awaiting your confirmation</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            The customer says they paid {order.currency} {formatNumber(Number(order.total))} to your account.
            Check your bank app, then confirm. {order.paymentProofAt ? `Proof uploaded ${formatDate(new Date(order.paymentProofAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.` : ""}
          </p>
          {order.paymentProofUrl ? (
            <a href={order.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="mb-3 block">
              {isImageProofUrl(order.paymentProofUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={order.paymentProofUrl} alt="Customer's payment proof" className="max-h-80 rounded-md border object-contain" />
              ) : (
                <span className="text-sm font-semibold underline">Open the customer&apos;s payment document</span>
              )}
            </a>
          ) : (
            <p className="mb-3 text-sm">No proof uploaded yet.</p>
          )}
          {order.paymentProofNote && <p className="mb-3 text-sm">Customer note: {order.paymentProofNote}</p>}
          {address?.phone && <p className="mb-3 text-xs text-muted-foreground">Customer phone: {address.phone}</p>}
          <ConfirmManualPaymentButton storeSlug={slug} orderId={order.id} />
        </div>
      )}

      <div className="mb-6 rounded-lg border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold">Status</h2>
        <OrderStatusControl storeSlug={slug} orderId={order.id} currentStatus={order.status} />
      </div>

      {order.channel !== "POS" && ["PAID", "IN_PROGRESS", "DELIVERED"].includes(order.status) && (
        <div className="mb-6 rounded-lg border bg-background p-4">
          <h2 className="mb-3 text-sm font-semibold">Delivery</h2>
          <DeliveryPanel
            storeSlug={slug}
            orderId={order.id}
            messagesOn={messagesOn}
            initial={{ status: order.deliveryStatus, trackingUrl: order.trackingUrl, riderName: order.riderName, riderPhone: order.riderPhone }}
          />
        </div>
      )}

      {order.dispute && (
        <div className="mb-6 rounded-lg border border-[var(--bn-admin-danger-line)] bg-[var(--bn-admin-danger-soft)] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--bn-admin-danger)]">
              <ShieldAlert className="h-4 w-4" />
              Dispute
            </h2>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${DISPUTE_STATUS_CONFIG[order.dispute.status].bg} ${DISPUTE_STATUS_CONFIG[order.dispute.status].text} ${DISPUTE_STATUS_CONFIG[order.dispute.status].ring}`}
            >
              {DISPUTE_STATUS_CONFIG[order.dispute.status].label}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-[var(--bn-admin-danger)]">
            The buyer has opened a dispute on this order. Head to the Resolution Center to review evidence and respond.
          </p>
          <Link
            href={`/disputes/${order.id}`}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--bn-admin-danger)] hover:text-[var(--bn-admin-danger)]"
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
