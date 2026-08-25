import { listOrdersForBuyerAtStore } from "@/lib/actions/order";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { DISPUTABLE_ORDER_STATUSES } from "@/lib/constants/dispute";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Package, CheckCircle2, XCircle, RotateCcw, AlertTriangle, ArrowUpRight, ShoppingBag, ShieldAlert, ArrowLeft, Wallet, Layers } from "lucide-react";
import { StoreFooter } from "@/components/storefront/store-footer";

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

export default async function StoreOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBranding(slug);
  if (!store) notFound();

  const customer = await requireStoreCustomer(slug);
  if (!customer) notFound();

  const orders = await listOrdersForBuyerAtStore(slug);
  const accent = store.themeColors?.primary || "#4f46e5"; // sensible fallback, still per-store when set

  const totalSpent = orders
    .filter((o) => !["CANCELLED", "REFUNDED"].includes(o.status))
    .reduce((sum, o) => sum + Number(o.total), 0);
  const currency = orders[0]?.currency ?? "NGN";
  const activeCount = orders.filter((o) => ["PAID", "IN_PROGRESS", "DELIVERED"].includes(o.status)).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ---------- STICKY HEADER ---------- */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link
            href={`/store/${slug}/account`}
            aria-label="Back to account"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          {store.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} className="h-9 w-9 rounded-lg object-cover ring-1 ring-slate-200" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-slate-900">My orders</h1>
            <p className="truncate text-xs text-slate-500">{store.name}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-6">
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
                <p className="truncate text-lg font-extrabold leading-tight">{currency} {totalSpent.toLocaleString()}</p>
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
              <h2 className="text-lg font-bold text-slate-900">No orders yet</h2>
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
                {orders.length} order{orders.length === 1 ? "" : "s"}
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
                            {order.currency} {Number(order.total).toLocaleString()}
                          </span>
                        </div>
                        {itemNames && <p className="mt-1.5 truncate text-sm font-medium text-slate-700">{itemNames}</p>}
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          #{order.id.slice(-8).toUpperCase()} · {new Date(order.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>

                      <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>

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
          </div>
        )}
      </div>
      <StoreFooter store={store} slug={slug} />
    </div>
  );
}
