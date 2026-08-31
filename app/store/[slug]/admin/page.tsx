import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { seedSampleListings, backfillListingImages } from "@/lib/actions/store";
import { getAdaptiveDashboardConfig } from "@/lib/adaptive-dashboard";
import { getDashboardInsights } from "@/lib/actions/analytics";
import { getTrustScoreBreakdown } from "@/lib/actions/trust-score";
import { TrustScoreCard } from "@/components/dashboard/trust-score-card";
import { AdaptiveDashboardHome, type DashboardBooking, type DashboardOrder, type DashboardProduct } from "@/components/dashboard/adaptive-dashboard-home";
import { SELLER_VISIBLE_ORDER_STATUSES } from "@/lib/constants/order";

export default async function StoreDashboardHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) notFound();

  const adaptive = getAdaptiveDashboardConfig(
    store.business.category,
    store.business.businessSubcategory,
    { sellsProducts: store.business.sellsProducts, offersServices: store.business.offersServices },
  );

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const paidStatuses = SELLER_VISIBLE_ORDER_STATUSES;

  const [
    productCount,
    serviceCount,
    bookingCount,
    customerCount,
    roomCount,
    inventoryRows,
    insights,
    trustScore,
    recentOrdersRaw,
    topGroups,
    bookingsRaw,
  ] = await Promise.all([
    prisma.product.count({ where: { storeId: store.id } }),
    prisma.service.count({ where: { storeId: store.id } }),
    prisma.booking.count({ where: { storeId: store.id, createdAt: { gte: since24h } } }),
    prisma.storeCustomer.count({ where: { storeId: store.id } }),
    prisma.serviceUnit.count({ where: { storeId: store.id } }),
    prisma.inventoryItem.findMany({ where: { storeId: store.id }, select: { quantity: true, lowStockThreshold: true } }),
    getDashboardInsights(store.id, slug),
    getTrustScoreBreakdown(store.business.id),
    prisma.order.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, total: true, status: true, channel: true, createdAt: true, buyer: { select: { name: true, email: true } } },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { not: null }, order: { storeId: store.id, status: { in: paidStatuses } } },
      _sum: { quantity: true, unitPrice: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.booking.findMany({
      where: { storeId: store.id, scheduledAt: { gte: since24h } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      select: { id: true, scheduledAt: true, guestName: true, guestEmail: true, service: { select: { name: true } }, unit: { select: { label: true } } },
    }),
  ]);

  const topIds = topGroups.map((g) => g.productId).filter((id): id is string => Boolean(id));
  const topProductsRaw = topIds.length
    ? await prisma.product.findMany({ where: { id: { in: topIds } }, select: { id: true, name: true, images: true } })
    : [];
  const topMap = new Map(topProductsRaw.map((p) => [p.id, p]));
  const topProducts: DashboardProduct[] = topGroups.flatMap((g) => {
    if (!g.productId) return [];
    const product = topMap.get(g.productId);
    if (!product) return [];
    const units = g._sum.quantity ?? 0;
    const unitPrice = Number(g._sum.unitPrice ?? 0);
    return [{ id: product.id, name: product.name, image: product.images[0] ?? null, orders: units, revenue: units * unitPrice }];
  });

  const recentOrders: DashboardOrder[] = recentOrdersRaw.map((o) => ({
    id: o.id,
    customer: o.buyer.name || o.buyer.email || "Customer",
    type: o.channel === "POS" ? "POS" : "Online",
    amount: Number(o.total),
    status: o.status.replaceAll("_", " "),
    time: new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit" }).format(o.createdAt),
  }));

  const bookings: DashboardBooking[] = bookingsRaw.map((b) => ({
    id: b.id,
    time: new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit" }).format(b.scheduledAt),
    customer: b.guestName || b.guestEmail || "Walk-in guest",
    detail: b.unit?.label ? `${b.service.name} · ${b.unit.label}` : b.service.name,
  }));

  const outOfStockCount = inventoryRows.filter((i) => i.quantity <= 0).length;
  const lowStockCount = inventoryRows.filter((i) => i.quantity > 0 && i.quantity <= i.lowStockThreshold).length;
  const activeCatalogCount = (store.business.sellsProducts ? await prisma.product.count({ where: { storeId: store.id, isPublished: true } }) : 0)
    + (store.business.offersServices ? await prisma.service.count({ where: { storeId: store.id, isPublished: true } }) : 0);

  const isEmpty = productCount === 0 && serviceCount === 0;
  const missingPhotoCount = 0; // Kept out of the new visual dashboard; photo backfill remains available from the catalog pages.

  async function seedForStore() {
    "use server";
    await seedSampleListings(slug);
  }

  async function backfillPhotos() {
    "use server";
    await backfillListingImages(slug);
  }

  return (
    <div className="-mx-4 -my-4 sm:-mx-6 lg:-mx-7 lg:-my-7">
      <AdaptiveDashboardHome
        slug={slug}
        storeName={store.name}
        logoUrl={store.logoUrl}
        userName={session?.user?.name}
        userImage={session?.user?.image}
        config={adaptive}
        data={{
          revenueToday: insights.revenueToday,
          ordersToday: insights.ordersToday,
          visitorsToday: insights.visitorsToday,
          conversionRate: insights.conversionRate,
          productCount,
          serviceCount,
          bookingCount,
          customerCount,
          roomCount,
          outOfStockCount,
          lowStockCount,
          activeCatalogCount,
          recentOrders,
          topProducts,
          bookings,
        }}
      />

      {(isEmpty || missingPhotoCount > 0 || trustScore) && (
        <div className="mx-auto hidden max-w-[1440px] px-6 pb-8 lg:px-7">
          {isEmpty && (
            <form action={seedForStore} className="mb-4 rounded-xl border border-[#e5b969] bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold">Your storefront has no listings yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Add starter listings matching your template to populate the store.</p>
              <button className="mt-3 rounded-lg bg-[#e9b45a] px-4 py-2 text-xs font-semibold">Add starter listings</button>
            </form>
          )}
          {missingPhotoCount > 0 && <form action={backfillPhotos} className="mb-4 rounded-xl border bg-white p-4 shadow-sm"><button className="rounded-lg bg-[#e9b45a] px-4 py-2 text-xs font-semibold">Add photos</button></form>}
          {trustScore && <TrustScoreCard breakdown={trustScore} />}
        </div>
      )}
    </div>
  );
}
