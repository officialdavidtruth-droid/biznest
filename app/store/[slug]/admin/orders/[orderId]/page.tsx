// Route: /store/[slug]/admin/orders/[orderId]
import { customerMessagingEnabled } from "@/lib/customer-messaging";
import { formatShipsOn } from "@/lib/preorder";
import { isImageProofUrl } from "@/lib/payments/manual-transfer";
import { getOrder } from "@/lib/actions/order";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, MessageCircle, Phone, Printer, ShieldAlert, MapPin } from "lucide-react";
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

const STATUS_TONE: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  IN_PROGRESS: "bg-sky-100 text-sky-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
  REFUNDED: "bg-slate-200 text-slate-700",
};

function statusLabel(status: string) {
  const t = status.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "CU";
}

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

  const shortId = order.id.slice(-8).toUpperCase();
  const money = (n: number) => `${order.currency} ${formatNumber(n)}`;
  const customerName = isPos ? (order.posCustomerName ?? "Walk-in customer") : (order.buyer.name ?? "Customer");
  const customerPhone = isPos ? order.posCustomerPhone : address?.phone ?? null;
  const customerEmail = isPos ? null : order.buyer.email;
  const waBase = customerPhone ? whatsappLink(customerPhone) : null;
  const waText = `Hello ${customerName}, this is about your order #${shortId}.`;
  const awaiting = order.status === "PENDING_PAYMENT" || order.status === "CANCELLED";
  const card = "rounded-2xl border bg-background p-4 shadow-sm sm:p-5";
  const ghostBtn = "inline-flex items-center justify-center gap-1.5 rounded-xl border bg-background px-3 py-2.5 text-xs font-semibold hover:bg-muted";

  return (
    <div className="mx-auto max-w-5xl space-y-4 sm:space-y-5">
      <div>
        <Link href={`/store/${slug}/admin/orders`} className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-muted"><ArrowLeft className="h-3.5 w-3.5" />All orders</Link>
        <div className={`${card} overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-background`}>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Order #{shortId}</h1>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[order.status] ?? "bg-muted text-foreground"}`}>{statusLabel(order.status)}</span>
            {isPos && <span className="rounded-full bg-[var(--bn-admin-surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--bn-admin-orange)]">POS · {order.posTenderType}</span>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Placed {formatDate(new Date(order.createdAt), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{awaiting ? "Order total" : "Customer paid"}</p>
              <p className="text-2xl font-bold tracking-tight sm:text-3xl">{money(total)}</p>
            </div>
            <p className="pb-1 text-xs text-muted-foreground">{order.items.length} item{order.items.length === 1 ? "" : "s"}</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <a href={`/receipts/${slug}/order/${order.id}`} target="_blank" rel="noopener noreferrer" className={ghostBtn}><Printer className="h-4 w-4" />Print receipt</a>
            {isPos && <PostToRoomButton storeSlug={slug} kind="order" id={order.id} rooms={rooms} postedTo={roomCharge?.reservation.room.name ?? null} />}
          </div>
        </div>
      </div>

      {order.channel !== "POS" && order.paymentProvider === "CASH" && order.status === "PENDING_PAYMENT" && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5">
          <h2 className="mb-1 text-sm font-semibold">Bank transfer: awaiting your confirmation</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            The customer says they paid {order.currency} {formatNumber(Number(order.total))} to your account.
            Check your bank app, then confirm. {order.paymentProofAt ? `Proof uploaded ${formatDate(new Date(order.paymentProofAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.` : ""}
          </p>
          {order.paymentProofUrl ? (
            <a href={order.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="mb-3 block">
              {isImageProofUrl(order.paymentProofUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={order.paymentProofUrl} alt="Customer's payment proof" className="max-h-80 w-full rounded-xl border bg-background object-contain" />
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

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-4 sm:space-y-5">
          <section className={card}>
            <h2 className="mb-3 text-sm font-semibold">Items</h2>
            <ul className="divide-y">
              {order.items.map((item) => {
                const name = item.product?.name ?? item.service?.name ?? "Item";
                return (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.quantity} × {money(Number(item.unitPrice))}</p>
                      {item.preorder && <span className="mt-1.5 inline-block rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Pre-order{item.preorderShipsOn ? ` · ships by ${formatShipsOn(item.preorderShipsOn)}` : ""}</span>}
                    </div>
                    <p className="shrink-0 text-sm font-semibold">{money(Number(item.unitPrice) * item.quantity)}</p>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-1 space-y-2 border-t pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{money(subtotal)}</dd></div>
              {deliveryFee > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Delivery fee</dt><dd>{money(deliveryFee)}</dd></div>}
              <div className="flex justify-between border-t pt-3 text-base font-bold"><dt>{awaiting ? "Order total" : "Customer paid"}</dt><dd>{money(total)}</dd></div>
              {commission > 0 && (
                <div className="space-y-2 rounded-xl bg-muted/40 p-3 text-xs">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Platform commission</dt><dd>-{money(commission)}</dd></div>
                  <div className="flex justify-between text-sm font-semibold"><dt>You keep (before payment fees)</dt><dd>{money(Math.max(0, total - commission))}</dd></div>
                </div>
              )}
            </dl>
          </section>

          <section className={card}>
            <h2 className="mb-3 text-sm font-semibold">Customer</h2>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials(customerName)}</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{customerName}</p>
                <p className="truncate text-xs text-muted-foreground">{[customerPhone, customerEmail].filter(Boolean).join(" · ") || "No contact details"}</p>
              </div>
            </div>
            {(customerPhone || customerEmail) && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {customerPhone ? <a href={`tel:${customerPhone}`} className={ghostBtn}><Phone className="h-4 w-4" />Call</a> : <span />}
                {waBase ? <a href={`${waBase}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer" className={ghostBtn}><MessageCircle className="h-4 w-4" />WhatsApp</a> : <span />}
                {customerEmail ? <a href={`mailto:${customerEmail}`} className={ghostBtn}><Mail className="h-4 w-4" />Email</a> : <span />}
              </div>
            )}
            {address && (
              <div className="mt-4 flex gap-2.5 rounded-xl bg-muted/40 p-3 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium">{address.fullName} · {address.phone}</p>
                  <p className="text-muted-foreground">{address.address}, {address.city}, {address.state}, {address.country}</p>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4 sm:space-y-5 lg:sticky lg:top-4">
          <section className={card}>
            <h2 className="mb-3 text-sm font-semibold">Status</h2>
            <OrderStatusControl storeSlug={slug} orderId={order.id} currentStatus={order.status} />
          </section>

          {order.channel !== "POS" && ["PAID", "IN_PROGRESS", "DELIVERED"].includes(order.status) && (
            <section className={card}>
              <h2 className="mb-3 text-sm font-semibold">Delivery</h2>
              <DeliveryPanel
                storeSlug={slug}
                orderId={order.id}
                messagesOn={messagesOn}
                initial={{ status: order.deliveryStatus, trackingUrl: order.trackingUrl, riderName: order.riderName, riderPhone: order.riderPhone }}
              />
            </section>
          )}

          {order.dispute && (
            <section className="rounded-2xl border border-[var(--bn-admin-danger-line)] bg-[var(--bn-admin-danger-soft)] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--bn-admin-danger)]"><ShieldAlert className="h-4 w-4" />Dispute</h2>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${DISPUTE_STATUS_CONFIG[order.dispute.status].bg} ${DISPUTE_STATUS_CONFIG[order.dispute.status].text} ${DISPUTE_STATUS_CONFIG[order.dispute.status].ring}`}>
                  {DISPUTE_STATUS_CONFIG[order.dispute.status].label}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-[var(--bn-admin-danger)]">The buyer has opened a dispute on this order. Head to the Resolution Center to review evidence and respond.</p>
              <Link href={`/disputes/${order.id}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--bn-admin-danger)]">Open dispute thread →</Link>
            </section>
          )}

          {REFUNDABLE_STATUSES.includes(order.status) && (
            <section className={card}>
              <h2 className="mb-3 text-sm font-semibold">Refund</h2>
              <RefundControl storeSlug={slug} orderId={order.id} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
