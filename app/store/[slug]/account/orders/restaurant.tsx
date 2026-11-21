import { prisma } from "@/lib/prisma";
import { listAwaitingTransferOrdersForBuyer, listOrdersForBuyerAtStore } from "@/lib/actions/order";
import { formatDate, formatNumber } from "@/lib/i18n/locale";
import { RestaurantOrders, type RestOrder } from "@/components/storefront/restaurant-orders";

export async function RestaurantOrdersPage({ slug }: { slug: string }) {
  const [store, orders, awaiting] = await Promise.all([
    prisma.store.findUnique({ where: { slug }, include: { business: true } }),
    listOrdersForBuyerAtStore(slug),
    listAwaitingTransferOrdersForBuyer(slug),
  ]);
  const cards: RestOrder[] = orders.map((o: any) => ({
    id: o.id,
    shortId: o.id.slice(-8).toUpperCase(),
    status: o.status,
    totalLabel: `${o.currency} ${formatNumber(Number(o.total))}`,
    placedTitle: formatDate(new Date(o.createdAt), { dateStyle: "medium", timeStyle: "short" }),
    delivery: o.deliveryStatus ?? null,
    trackingUrl: o.trackingUrl && /^https?:\/\//i.test(o.trackingUrl) ? o.trackingUrl : null,
    items: o.items.map((i: any) => ({
      id: i.product?.id ?? i.service?.id ?? null,
      kind: i.product ? "product" : i.service ? "service" : null,
      name: i.product?.name ?? i.service?.name ?? "Item",
      image: i.product?.images?.[0] ?? i.service?.images?.[0] ?? null,
      qty: i.quantity,
      price: Number(i.product?.price ?? i.service?.price ?? 0),
      currency: o.currency,
      hasVariants: !!i.product?.hasVariants,
    })),
  }));
  const wait = awaiting.map((o: any) => ({ id: o.id, label: `Order #${o.id.slice(-8).toUpperCase()} · ${o.currency} ${formatNumber(Number(o.total))}`, note: o.paymentProofUrl ? "Payment proof sent. Waiting for the store to confirm." : "Waiting for your bank transfer. Tap to pay and upload proof." }));
  return <RestaurantOrders store={store} slug={slug} orders={cards} awaiting={wait} />;
}
