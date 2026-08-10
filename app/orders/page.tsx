import { listOrdersForBuyer } from "@/lib/actions/order";
import { DISPUTABLE_ORDER_STATUSES } from "@/lib/constants/dispute";
import Link from "next/link";
import { Package, Clock, CheckCircle2, XCircle, RotateCcw, AlertTriangle, ArrowUpRight, ShoppingBag, ShieldAlert } from "lucide-react";

// Buyer-facing order history — deliberately NOT themed per-store (a buyer's
// order list spans every store they've ever bought from, so it can't pick
// up any one seller's template colors). Instead this gets its own
// confident, high-contrast look: gradient store avatars, a live product
// thumbnail per order, animated status pills, and a running spend summary
// up top — built once, shared by every buyer regardless of which template
// each seller happens to use.

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Package; bg: string; text: string; ring: string }> = {
  PENDING_PAYMENT: { label: "Awaiting payment", icon: Clock, bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
  PAID: { label: "Paid", icon: CheckCircle2, bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
  IN_PROGRESS: { label: "Preparing", icon: Package, bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-200" },
  DELIVERED: { label: "Delivered", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  COMPLETED: { label: "Completed", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  CANCELLED: { label: "Cancelled", icon: XCircle, bg: "bg-gray-100", text: "text-gray-600", ring: "ring-gray-200" },
  REFUNDED: { label: "Refunded", icon: RotateCcw, bg: "bg-gray-100", text: "text-gray-600", ring: "ring-gray-200" },
  DISPUTED: { label: "Disputed", icon: AlertTriangle, bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200" },
};

const AVATAR_GRADIENTS = [
  "from-violet-500 to-fuchsia-500",
  "from-blue-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-orange-500 to-amber-400",
  "from-pink-500 to-rose-400",
  "from-indigo-500 to-blue-400",
];

function gradientFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

export default async function BuyerOrdersPage() {
  const orders = await listOrdersForBuyer();

  const totalSpent = orders
    .filter((o) => !["CANCELLED", "REFUNDED", "PENDING_PAYMENT"].includes(o.status))
    .reduce((sum, o) => sum + Number(o.total), 0);
  const currency = orders[0]?.currency ?? "NGN";
  const activeCount = orders.filter((o) => ["PAID", "IN_PROGRESS", "DELIVERED"].includes(o.status)).length;
  const storeCount = new Set(orders.map((o) => o.store.slug)).size;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="mx-auto max-w-3xl px-6 py-10">
        {/* ---------- HERO ---------- */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">My orders</h1>
          <p className="mt-1 text-sm text-slate-500">Everything you've bought, all in one place.</p>
        </div>

        {orders.length > 0 && (
          <div className="mb-8 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 p-4 text-white shadow-lg shadow-violet-200">
              <p className="text-[11px] font-medium uppercase tracking-wide text-violet-100">Total spent</p>
              <p className="mt-1 text-xl font-extrabold">{currency} {totalSpent.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Active orders</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">{activeCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Stores</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">{storeCount}</p>
            </div>
          </div>
        )}

        {/* ---------- EMPTY STATE ---------- */}
        {orders.length === 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-8 py-16 text-center">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100" />
            <div className="absolute -bottom-14 -left-14 h-48 w-48 rounded-full bg-gradient-to-tr from-indigo-100 to-blue-50" />
            <div className="relative">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 shadow-lg shadow-violet-200">
                <ShoppingBag className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">No orders yet</h2>
              <p className="mx-auto mt-1.5 max-w-xs text-sm text-slate-500">
                Once you buy something from a BizNest store, it'll show up here with live status updates.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
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
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
                >
                  <Link
                    href={`/store/${order.store.slug}/orders/${order.id}/confirmation`}
                    className="flex items-center gap-4 p-4"
                  >
                    {/* Thumbnail: product image if we have one, otherwise a gradient store-initial tile */}
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(order.store.name)} text-lg font-bold text-white`}>
                          {order.store.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {order.items.length > 1 && (
                        <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                          {order.items.length}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-slate-900">{order.store.name}</p>
                        <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${status.bg} ${status.text} ${status.ring}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        #{order.id.slice(-8).toUpperCase()} · {new Date(order.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      {itemNames && <p className="mt-1 truncate text-xs text-slate-500">{itemNames}</p>}
                    </div>

                    <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                      <span className="text-sm font-extrabold text-slate-900">{order.currency} {Number(order.total).toLocaleString()}</span>
                      <span className="flex items-center gap-0.5 text-[11px] font-medium text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
                        View <ArrowUpRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>

                  {(hasDispute || canDispute) && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2">
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
        )}
      </div>
    </div>
  );
}
