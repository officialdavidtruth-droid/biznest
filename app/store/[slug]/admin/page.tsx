import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AdaptiveDashboardHome, type DashboardHomeData, type DashboardBooking, type DashboardOrder, type DashboardProduct } from "@/components/dashboard/adaptive-dashboard-home";
import { getAdaptiveDashboardConfig } from "@/lib/adaptive-dashboard";
import { getDashboardInsights } from "@/lib/actions/analytics";
import { SELLER_VISIBLE_ORDER_STATUSES } from "@/lib/constants/order";

/**
 * Merchant overview only.
 *
 * IMPORTANT: /store/[slug]/admin is the business dashboard route. It must
 * never render a storefront/template. The public website lives at
 * /store/[slug] (and /store/[slug]/[pageSlug]).
 *
 * The previous implementation of this route contained the public storefront
 * renderer, which is why opening "Overview > Dashboard" displayed the live
 * Velox Space template inside the merchant admin shell.
 */
export default async function StoreAdminOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();

  if (!session?.user?.id) return null;

  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      business: true,
      template: true,
    },
  });

  if (!store) notFound();

  const config = getAdaptiveDashboardConfig(store.businessType, getOnboardingSubcategory(store.onboardingProfile), {
    sellsProducts: store.business.sellsProducts,
    offersServices: store.business.offersServices,
  });

  const insightsPromise = getDashboardInsights(store.id, slug);
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const productCapability = store.business.sellsProducts || config.modules.some((m) => m.id === "products");
  const serviceCapability = store.business.offersServices || config.modules.some((m) => m.id === "services");
  const bookingCapability = config.modules.some((m) => m.id === "bookings");
  const isHotel = config.businessType === "Hotel & Lodging";

  const [
    insights,
    productCount,
    serviceCount,
    customerCount,
    outOfStockCount,
    lowStockCount,
    roomCount,
    todayBookingCount,
    todayBookings,
    recentOrders,
    topProductGroups,
    topServiceGroups,
  ] = await Promise.all([
    insightsPromise,
    prisma.product.count({ where: { storeId: store.id, isPublished: true } }),
    prisma.service.count({ where: { storeId: store.id, isPublished: true } }),
    prisma.storeCustomer.count({ where: { storeId: store.id } }),
    prisma.product.count({
      where: {
        storeId: store.id,
        isPublished: true,
        OR: [
          { inventory: { is: null } },
          { inventory: { quantity: { lte: 0 } } },
        ],
      },
    }),
    prisma.product.count({
      where: {
        storeId: store.id,
        isPublished: true,
        inventory: { quantity: { gt: 0, lte: 5 } },
      },
    }),
    isHotel
      ? prisma.propertyRoom.count({ where: { storeId: store.id, status: "AVAILABLE" } })
      : Promise.resolve(0),
    bookingCapability
      ? prisma.booking.count({
          where: {
            storeId: store.id,
            scheduledAt: { gte: dayStart, lt: dayEnd },
            status: { not: "CANCELLED" },
          },
        })
      : Promise.resolve(0),
    bookingCapability
      ? prisma.booking.findMany({
          where: {
            storeId: store.id,
            scheduledAt: { gte: dayStart, lt: dayEnd },
            status: { not: "CANCELLED" },
          },
          include: { service: true },
          orderBy: { scheduledAt: "asc" },
          take: 5,
        })
      : Promise.resolve([]),
    prisma.order.findMany({
      where: { storeId: store.id },
      include: { buyer: true, items: { include: { product: true, service: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    productCapability
      ? prisma.orderItem.groupBy({
          by: ["productId"],
          where: {
            productId: { not: null },
            order: { storeId: store.id, status: { in: SELLER_VISIBLE_ORDER_STATUSES } },
          },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 5,
        })
      : Promise.resolve([]),
    serviceCapability
      ? prisma.orderItem.groupBy({
          by: ["serviceId"],
          where: {
            serviceId: { not: null },
            order: { storeId: store.id, status: { in: SELLER_VISIBLE_ORDER_STATUSES } },
          },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const topProductIds = topProductGroups.map((g) => g.productId).filter((id): id is string => Boolean(id));
  const topServiceIds = topServiceGroups.map((g) => g.serviceId).filter((id): id is string => Boolean(id));

  // GroupBy gives us the best-selling IDs cheaply. Fetch only the order items
  // belonging to those IDs to calculate historical revenue using the price
  // actually paid on each order item (rather than the product's current price).
  const [topProducts, topServices, topProductOrderItems, topServiceOrderItems] = await Promise.all([
    topProductIds.length
      ? prisma.product.findMany({ where: { id: { in: topProductIds } }, select: { id: true, name: true, images: true } })
      : Promise.resolve([]),
    topServiceIds.length
      ? prisma.service.findMany({ where: { id: { in: topServiceIds } }, select: { id: true, name: true, images: true } })
      : Promise.resolve([]),
    topProductIds.length
      ? prisma.orderItem.findMany({
          where: { productId: { in: topProductIds }, order: { storeId: store.id, status: { in: SELLER_VISIBLE_ORDER_STATUSES } } },
          select: { productId: true, quantity: true, unitPrice: true },
        })
      : Promise.resolve([]),
    topServiceIds.length
      ? prisma.orderItem.findMany({
          where: { serviceId: { in: topServiceIds }, order: { storeId: store.id, status: { in: SELLER_VISIBLE_ORDER_STATUSES } } },
          select: { serviceId: true, quantity: true, unitPrice: true },
        })
      : Promise.resolve([]),
  ]);

  const productMap = new Map(topProducts.map((p) => [p.id, p]));
  const serviceMap = new Map(topServices.map((s) => [s.id, s]));
  const productRevenue = new Map<string, number>();
  const serviceRevenue = new Map<string, number>();
  for (const item of topProductOrderItems) {
    if (item.productId) productRevenue.set(item.productId, (productRevenue.get(item.productId) ?? 0) + Number(item.unitPrice) * item.quantity);
  }
  for (const item of topServiceOrderItems) {
    if (item.serviceId) serviceRevenue.set(item.serviceId, (serviceRevenue.get(item.serviceId) ?? 0) + Number(item.unitPrice) * item.quantity);
  }

  const topCatalog = [
    ...topProductGroups.map((group): DashboardProduct | null => {
      const item = group.productId ? productMap.get(group.productId) : null;
      return item
        ? {
            id: item.id,
            name: item.name,
            image: item.images[0] ?? null,
            orders: group._sum.quantity ?? 0,
            revenue: productRevenue.get(item.id) ?? 0,
          }
        : null;
    }),
    ...topServiceGroups.map((group): DashboardProduct | null => {
      const item = group.serviceId ? serviceMap.get(group.serviceId) : null;
      return item
        ? {
            id: item.id,
            name: item.name,
            image: item.images[0] ?? null,
            orders: group._sum.quantity ?? 0,
            revenue: serviceRevenue.get(item.id) ?? 0,
          }
        : null;
    }),
  ]
    .filter((item): item is DashboardProduct => Boolean(item))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const data: DashboardHomeData = {
    revenueToday: insights.revenueToday,
    ordersToday: insights.ordersToday,
    visitorsToday: insights.visitorsToday,
    conversionRate: insights.conversionRate,
    productCount,
    serviceCount,
    bookingCount: todayBookingCount,
    customerCount,
    roomCount,
    outOfStockCount,
    lowStockCount,
    activeCatalogCount: productCapability && serviceCapability
      ? productCount + serviceCount
      : productCapability
        ? productCount
        : serviceCount,
    recentOrders: recentOrders.map((order): DashboardOrder => ({
      id: order.id,
      customer: order.channel === "POS"
        ? order.posCustomerName || "Walk-in customer"
        : order.buyer.name || order.buyer.email || "Customer",
      type: order.channel === "POS" ? "POS" : "Online",
      amount: Number(order.total),
      status: formatOrderStatus(order.status),
      time: formatNigeriaTime(order.createdAt),
    })),
    topProducts: topCatalog,
    bookings: todayBookings.map((booking): DashboardBooking => ({
      id: booking.id,
      time: formatNigeriaTime(booking.scheduledAt),
      customer: booking.guestName || "Walk-in guest",
      detail: booking.service.name,
      guests: booking.partySize ?? undefined,
    })),
    revenueYesterday: insights.revenueYesterday,
    ordersYesterday: insights.ordersYesterday,
    newCustomersToday: insights.newCustomersToday,
    newCustomersYesterday: insights.newCustomersYesterday,
    avgOrderValueToday: insights.avgOrderValueToday,
    avgOrderValueYesterday: insights.avgOrderValueYesterday,
    hourlyRevenue: insights.hourlyRevenue,
  };

  return (
    <AdaptiveDashboardHome
      slug={slug}
      storeName={store.name}
      logoUrl={store.logoUrl}
      userName={session.user.name}
      userImage={session.user.image}
      config={config}
      data={data}
    />
  );
}

function getOnboardingSubcategory(profile: unknown): string | null {
  if (!profile || typeof profile !== "object") return null;
  const value = (profile as Record<string, unknown>).subcategory;
  return typeof value === "string" ? value : null;
}

function formatNigeriaTime(date: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatOrderStatus(status: string): string {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}