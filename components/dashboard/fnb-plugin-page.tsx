import { getPluginEntitlement } from "@/lib/plugins";
import { prisma } from "@/lib/prisma";
import { FnbWorkspace } from "./fnb-workspace";
import { WalletCards, ShoppingBag, CalendarDays, Package } from "lucide-react";
import { notFound, redirect } from "next/navigation";

export async function FnbPluginPage({ slug }: { slug: string }) {
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, name: true, businessType: true } });
  if (!store) notFound();
  const entitlement = await getPluginEntitlement(store.id, "fnb");
  if (!entitlement.allowed || !entitlement.installed) redirect(`/store/${slug}/admin/apps`);

  const [orders, products, bookings, inventory] = await Promise.all([
    prisma.order.findMany({ where: { storeId: store.id, status: { in: ["PAID", "IN_PROGRESS", "COMPLETED", "DELIVERED"] } }, include: { buyer: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.product.findMany({ where: { storeId: store.id, isPublished: true }, include: { inventory: true }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.booking.findMany({ where: { storeId: store.id, scheduledAt: { gte: new Date() } }, include: { unit: { select: { label: true } } }, orderBy: { scheduledAt: "asc" }, take: 5 }),
    prisma.inventoryItem.findMany({ where: { storeId: store.id }, select: { quantity: true, lowStockThreshold: true }, take: 300 }),
  ]);

  const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const lowStock = inventory.filter(i => i.quantity <= i.lowStockThreshold).length;
  const currency = orders[0]?.currency ?? products[0]?.currency ?? "NGN";

  return <FnbWorkspace
    slug={slug}
    storeName={store.name}
    currency={currency}
    lowStock={lowStock}
    metrics={[
      { label: "Recent revenue", value: `${currency} ${revenue.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`, note: "From the latest visible orders", icon: WalletCards },
      { label: "Orders", value: String(orders.length), note: "Recent fulfilled activity", icon: ShoppingBag },
      { label: "Upcoming tables", value: String(bookings.length), note: "Reservations on the schedule", icon: CalendarDays },
      { label: "Stock alerts", value: String(lowStock), note: "Low or out of stock", icon: Package },
    ]}
    orders={orders.map(o => ({ id: o.id, customer: o.channel === "POS" ? o.posCustomerName ?? "Walk-in customer" : o.buyer.name ?? o.buyer.email, total: Number(o.total), currency: o.currency, status: o.status, channel: o.channel === "POS" ? "POS" : "Online" }))}
    products={products.map(p => ({ id: p.id, name: p.name, price: Number(p.price), currency: p.currency, quantity: p.inventory?.quantity ?? null, image: p.images[0] ?? null }))}
    bookings={bookings.map(b => ({ id: b.id, guest: b.guestName ?? "Guest", time: b.scheduledAt.toISOString(), status: b.status, party: b.partySize, unit: b.unit?.label ?? null }))}
  />;
}
