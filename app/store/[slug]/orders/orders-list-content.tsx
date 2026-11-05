import { deliveryStatusLabel } from "@/lib/delivery";
import { listAwaitingTransferOrdersForBuyer, listOrdersForBuyerAtStore } from "@/lib/actions/order";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { DISPUTABLE_ORDER_STATUSES } from "@/lib/constants/dispute";
import { getAccountCopy } from "@/lib/account-copy";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ShoppingBag } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/i18n/locale";
import { accountAccent, accentInk } from "@/lib/account-theme";
import { OrdersList, OrdersSummary, type OrderCardData } from "@/components/storefront/orders-list";
import { orderPhase, relativeDay, spentByCurrency } from "@/lib/orders-view";

// Store-scoped order history. A customer account only ever belongs to one
// store (see StoreCustomer), so this is simply "my orders here" — themed
// with that store's own colors and logo rather than the generic BizNest
// look the old cross-store /orders page used.
//
// Note: orders that were never paid for are excluded upstream in
// listOrdersForBuyerAtStore — an unpaid order is still effectively sitting
// in the customer's cart, not a real order yet, so it has no business here.

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
  const accent = accountAccent(store.themeColors); // per-store colour, never too pale to read
  // getAccountCopy only varies by business category; the template name is ignored.
  const copy = getAccountCopy(undefined, store.businessCategory);
  const orderWord = copy.orders.toLowerCase();

  // Totals are kept per currency so mixed-currency histories are never added together under one label.
  const plain = orders.map((o) => ({ status: o.status, currency: o.currency, total: Number(o.total) }));
  const spentLines = spentByCurrency(plain).map((m) => `${m.currency} ${formatNumber(m.amount)}`);
  if (spentLines.length === 0) spentLines.push(`${orders[0]?.currency ?? "NGN"} ${formatNumber(0)}`);
  const inProgress = orders.filter((o) => orderPhase(o.status) === "active").length;
  const delivered = orders.filter((o) => orderPhase(o.status) === "delivered").length;
  const now = new Date();

  // Plain, serialisable cards for the interactive list: no Decimal or Date objects cross to the client.
  const cards: OrderCardData[] = orders.map((o) => {
    const placed = new Date(o.createdAt);
    return {
      id: o.id,
      shortId: o.id.slice(-8).toUpperCase(),
      status: o.status,
      currency: o.currency,
      totalLabel: `${o.currency} ${formatNumber(Number(o.total))}`,
      placedLabel: relativeDay(placed, now, formatDate(placed, { month: "short", day: "numeric", year: "numeric" })),
      placedTitle: formatDate(placed, { dateStyle: "long", timeStyle: "short" }),
      trackingUrl: o.trackingUrl && /^https?:\/\//i.test(o.trackingUrl) ? o.trackingUrl : null,
      deliveryLabel: o.deliveryStatus ? deliveryStatusLabel(o.deliveryStatus) : null,
      riderName: o.riderName ?? null,
      hasDispute: !!o.dispute,
      canDispute: (DISPUTABLE_ORDER_STATUSES as readonly string[]).includes(o.status),
      items: o.items.map((i) => {
        const name = i.product?.name ?? i.service?.name ?? "Item";
        const image = i.product?.images?.[0] ?? i.service?.images?.[0] ?? null;
        const href = i.product ? `/store/${slug}/product/${i.product.id}` : i.service ? `/store/${slug}/service/${i.service.id}` : `/store/${slug}`;
        return { name, image, qty: i.quantity, href };
      }),
    };
  });

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
          <OrdersSummary spentLines={spentLines} inProgress={inProgress} delivered={delivered} accent={accent} />
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
            <OrdersList slug={slug} orders={cards} accent={accent} accentInk={accentInk(accent)} storeName={store.name} orderWord={orderWord} />
            <p className="mt-4 text-center text-xs text-slate-500">
              Can&apos;t find an order?{" "}
              <Link href={`/store/${slug}/account/recover-order`} className="font-semibold underline underline-offset-2 hover:text-slate-800">Recover it here</Link>
            </p>
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
