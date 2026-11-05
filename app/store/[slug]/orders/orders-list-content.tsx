import { deliveryStatusLabel } from "@/lib/delivery";
import { listAwaitingTransferOrdersForBuyer, listOrdersForBuyerAtStore } from "@/lib/actions/order";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { DISPUTABLE_ORDER_STATUSES } from "@/lib/constants/dispute";
import { getAccountCopy } from "@/lib/account-copy";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Package, CheckCircle2, XCircle, RotateCcw, AlertTriangle, ArrowUpRight, ShoppingBag, ShieldAlert, Wallet, Layers } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/i18n/locale";

// Store-scoped order history. A customer account only ever belongs to one
// store (see StoreCustomer), so this is simply "my orders here" — themed
// with that store's own colors and logo rather than the generic BizNest
// look the old cross-store /orders page used.
//
// Note: orders that were never paid for are excluded upstream in
// listOrdersForBuyerAtStore — an unpaid order is still effectively sitting
// in the customer's cart, not a real order yet, so it has no business here.

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Package; dot: string; bg: string; text: string }> = {
  PAID: { label: "Paid", icon: CheckCircle2, dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700" },
  IN_PROGRESS: { label: "Preparing", icon: Package, dot: "bg-indigo-500", bg: "bg-indigo-50", text: "text-indigo-700" },
  DELIVERED: { label: "Delivered", icon: CheckCircle2, dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
  COMPLETED: { label: "Completed", icon: CheckCircle2, dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
  CANCELLED: { label: "Cancelled", icon: XCircle, dot: "bg-gray-400", bg: "bg-gray-100", text: "text-gray-600" },
  REFUNDED: { label: "Refunded", icon: RotateCcw, dot: "bg-gray-400", bg: "bg-gray-100", text: "text-gray-600" },
  DISPUTED: { label: "Disputed", icon: AlertTriangle, dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700" },
};

// The standalone, full-chrome route (orders/page.tsx) wraps this component. It
// is also reachable nested inside the themed account shell at /account/orders
// (see that route's page.tsx) — that page renders OrdersListContent directly,
// on purpose, so it doesn't stack its own sticky header/footer on top of the
// shell's header/sidebar that already surround it.
const ORDER_LIST_LIMIT = 200; // must match `take` in listOrdersForBuyerAtStore

export async function OrdersListContent({ slug }: { slug: string }) {
  const store = await getStoreBranding(slug);
  if (!store) notFound();

  const customer = await requireStoreCustomer(slug);
  if (!customer) notFound();

  const [orders, awaiting] = await Promise.all([
    listOrdersForBuyerAtStore(slug),
    listAwaitingTransferOrdersForBuyer(slug),
  ]);
  const accent = store.themeColors?.primary || "#4f46e5"; // sensible fallback, still per-store when set
  // getAccountCopy only varies by business category; the template name is ignored.
  const copy = getAccountCopy(undefined, store.businessCategory);
  const orderWord = copy.orders.toLowerCase();

  // Money the customer has actually spent and kept: paid/fulfilled orders only.
  // Cancelled, refunded and disputed orders are left out (a disputed order may
  // end up refunded). Totals are kept per currency so mixed-currency histories
  // are never added together under one label.
  const spentByCurrency = new Map<string, number>();
  for (const o of orders) {
    if (!["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"].includes(o.status)) continue;
    spentByCurrency.set(o.currency, (spentByCurrency.get(o.currency) ?? 0) + Number(o.total));
  }
  const spentLines = [...spentByCurrency.entries()].map(([currency, amount]) => `${currency} ${formatNumber(amount)}`);
  if (spentLines.length === 0) spentLines.push(`${orders[0]?.currency ?? "NGN"} ${formatNumber(0)}`);
  const activeCount = orders.filter((o) => ["PAID", "IN_PROGRESS", "DELIVERED"].includes(o.status)).length;

  return (
    <>
        {awaiting.length > 0 && (
          <div className="mb-6 space-y-2">
            {awaiting.map((o) => (
              <Link
                key={o.id}
                href={`/store/${slug}/orders/${o.id}/pay`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 no-underline shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-amber-900">Order #{o.id.slice(-8).toUpperCase()} · {o.currency} {formatNumber(Number(o.total))}</p>
                  <p className="text-xs text-amber-800">{o.paymentProofUrl ? "Payment proof sent. Waiting for the store to confirm." : "Waiting for your bank transfer. Tap to pay and upload proof."}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-amber-800" />
              </Link>
            ))}
          </div>
        )}

        {orders.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div
              className="flex items-center gap-3 rounded-2xl p-4 text-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}b3)` }}
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/15">
                <Wallet className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-white/80">Total spent</p>
                {spentLines.map((line) => (
                  <p key={line} className="truncate text-lg font-extrabold leading-tight">{line}</p>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `${accent}1a`, color: accent }}>
                <Layers className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Active orders</p>
                <p className="text-lg font-extrabold leading-tight text-slate-900">{activeCount}</p>
              </div>
            </div>
          </div>
        )}

        {/* ---------- EMPTY STATE ---------- */}
        {orders.length === 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-8 py-16 text-center">
            <div className="relative">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg" style={{ background: accent }}>
                <ShoppingBag className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">No {orderWord} yet</h2>
              <p className="mx-auto mt-1.5 max-w-xs text-sm text-slate-500">
                Once you pay for something from {store.name}, it&apos;ll show up here with live status updates.
              </p>
              <Link
                href={`/store/${slug}/account/recover-order`}
                className="mt-4 inline-block text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-800"
              >
                Already placed an order but don&apos;t see it? Recover it here
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {orders.length} {orderWord.replace(/s$/, "")}{orders.length === 1 ? "" : "s"}
              </p>
              <Link
                href={`/store/${slug}/account/recover-order`}
                className="text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-800"
              >
                Missing an order? Recover it here
              </Link>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {orders.map((order, idx) => {
                const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PAID;
                const StatusIcon = status.icon;
                const firstImage = order.items.find((i) => i.product?.images?.[0] || i.service?.images?.[0]);
                const image = firstImage?.product?.images?.[0] ?? firstImage?.service?.images?.[0] ?? null;
                const itemNames = order.items.map((i) => i.product?.name ?? i.service?.name).filter(Boolean).join(", ");
                const canDispute = (DISPUTABLE_ORDER_STATUSES as readonly string[]).includes(order.status);
                const hasDispute = !!order.dispute;

                return (
                  <div
                    key={order.id}
                    className={`group relative transition-colors hover:bg-slate-50 ${idx !== 0 ? "border-t border-slate-100" : ""}`}
                  >
                    <span className={`absolute left-0 top-0 h-full w-1 ${status.dot}`} aria-hidden />
                    <Link href={`/store/${slug}/orders/${order.id}/confirmation`} className="flex items-center gap-4 py-4 pl-5 pr-4">
                      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-base font-bold text-white" style={{ background: accent }}>
                            {store.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {order.items.length > 1 && (
                          <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                            {order.items.length}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.bg} ${status.text}`}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                          <span className="flex-shrink-0 text-sm font-extrabold text-slate-900">
                            {order.currency} {formatNumber(Number(order.total))}
                          </span>
                        </div>
                        {itemNames && <p className="mt-1.5 truncate text-sm font-medium text-slate-700">{itemNames}</p>}
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          #{order.id.slice(-8).toUpperCase()} · {formatDate(new Date(order.createdAt), { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>

                      <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>

                    {order.trackingUrl && /^https?:\/\//i.test(order.trackingUrl) && (
                      <div className="border-t border-slate-100 bg-slate-50/60 py-2 pl-5 pr-4 text-[11px] font-semibold">
                        <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                          Track delivery{order.deliveryStatus ? ` · ${deliveryStatusLabel(order.deliveryStatus)}` : ""} →
                        </a>
                        {order.riderName && <span className="ml-2 font-normal text-slate-500">Rider: {order.riderName}</span>}
                      </div>
                    )}

                    {(hasDispute || canDispute) && (
                      <div className="border-t border-slate-100 bg-slate-50/60 py-2 pl-5 pr-4">
                        <Link
                          href={`/disputes/${order.id}`}
                          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                            hasDispute ? "text-blue-600 hover:text-blue-700" : "text-red-600 hover:text-red-700"
                          }`}
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          {hasDispute ? "View dispute" : "Report a problem"}
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {orders.length >= ORDER_LIST_LIMIT && (
              <p className="mt-3 text-center text-xs text-slate-400">
                Showing your {ORDER_LIST_LIMIT} most recent {orderWord}.
              </p>
            )}
          </div>
        )}
    </>
  );
}
