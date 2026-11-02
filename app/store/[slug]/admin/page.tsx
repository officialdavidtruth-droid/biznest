import { getCanonicalBusinessType } from "@/lib/business-identity";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { AdaptiveDashboardHome, type DashboardHomeData, type DashboardBooking, type DashboardOrder, type DashboardProduct } from "@/components/dashboard/adaptive-dashboard-home";
import { getAdaptiveDashboardConfig } from "@/lib/adaptive-dashboard";
import { getDashboardInsights, type DashboardInsights } from "@/lib/actions/analytics";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { addLocalDays, getLocalDateKey, getLocalMinutes, localDateStartUtc } from "@/lib/timezone";
import { SELLER_VISIBLE_ORDER_STATUSES } from "@/lib/constants/order";
import { formatDate } from "@/lib/i18n/locale";
import { getStoreAccessRole } from "@/lib/access/store-access";
import { FirstSaleChecklist } from "@/components/dashboard/first-sale-checklist";
import { loadFirstSaleChecklist } from "@/lib/onboarding-checklist-data";
import { ChurnTipCard } from "@/components/dashboard/churn-tip-card";
import { getOpenChurnTip } from "@/lib/actions/churn";

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
    include: { business: true },
  });

  if (!store) notFound();

  const config = getAdaptiveDashboardConfig(getCanonicalBusinessType({ businessCategory: store.business?.category, storeBusinessType: store.businessType }), store.business?.businessSubcategory ?? getOnboardingSubcategory(store.onboardingProfile), {
    sellsProducts: store.business.sellsProducts,
    offersServices: store.business.offersServices,
  });

  // Staff only see revenue/visitor figures if they were granted "Analytics &
  // reports". Check first instead of letting getDashboardInsights throw, which
  // used to crash the whole overview into the error boundary for them.
  const analyticsAccessPromise = assertStorePermission(slug, "analytics");
  const insightsPromise: Promise<DashboardInsights | null> = analyticsAccessPromise.then((access) =>
    access.success ? getDashboardInsights(store.id, slug) : null,
  );

  // "Get your first sale" checklist: owners only, and never allowed to break the dashboard.
  // One role lookup shared by both owner-only cards below.
  const rolePromise = getStoreAccessRole(session.user.id, session.user.role, store).catch(() => null);
  const checklistPromise = rolePromise
    .then((role) => (role === "OWNER" ? loadFirstSaleChecklist(store.id) : null))
    .catch(() => null);
  // Churn-watch tip: owners only, never allowed to break the dashboard.
  const churnTipPromise = rolePromise
    .then((role) => (role === "OWNER" ? getOpenChurnTip(store.id, slug) : null))
    .catch(() => null);
  const now = new Date();
  // "Today" is the store's local calendar day (same definition as
  // getDashboardInsights), not the server's clock, which is UTC on Vercel.
  const tz = store.timezone || "Africa/Lagos";
  const todayKey = getLocalDateKey(now, tz);
  const dayStart = localDateStartUtc(todayKey, tz);
  const dayEnd = localDateStartUtc(addLocalDays(todayKey, 1), tz);

  // Top products/services: last 30 days, paid sales only (same definition of a
  // sale as the KPIs), so the card reflects current performance and the
  // order-item queries stay bounded.
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const topSaleWhere = { status: { in: PAID_ORDER_STATUSES }, createdAt: { gte: since30d } };

  const productCapability = store.business.sellsProducts || config.modules.some((m) => m.id === "products");
  const serviceCapability = store.business.offersServices || config.modules.some((m) => m.id === "services");
  const bookingCapability = config.modules.some((m) => m.id === "bookings");
  const isHotel = config.businessType === "Hotel & Lodging";
  const isRestaurant = config.businessType === "Restaurant";

  const [
    insightsResult,
    productCount,
    serviceCount,
    customerCount,
    outOfStockCount,
    roomCount,
    roomAttentionCount,
    todayBookingCount,
    todayBookings,
    recentOrders,
    topProductGroups,
    topServiceGroups,
    kitchenGroups,
  ] = await Promise.all([
    insightsPromise,
    prisma.product.count({ where: { storeId: store.id, isPublished: true } }),
    prisma.service.count({ where: { storeId: store.id, isPublished: true } }),
    prisma.storeCustomer.count({ where: { storeId: store.id } }),
    // Same rule as getProductStats (lib/actions/product.ts) so this card always
    // matches the Products page: physical products only; a plain product is out
    // when its inventory row is at zero; a variant product is out only when no
    // active variant has stock. Unpublished items are included on purpose --
    // the out-of-stock automation unpublishes them, and they still need restock.
    prisma.product.count({
      where: {
        storeId: store.id,
        type: "PHYSICAL",
        OR: [
          { hasVariants: false, inventory: { is: { quantity: { lte: 0 } } } },
          { hasVariants: true, variants: { none: { isActive: true, quantity: { gt: 0 } } } },
        ],
      },
    }),
    isHotel
      ? prisma.propertyRoom.count({ where: { storeId: store.id, status: "AVAILABLE" } })
      : Promise.resolve(0),
    // Hotel "Needs attention": rooms someone must act on. CLEANING is left out
    // on purpose -- housekeeping is already handling those.
    isHotel
      ? prisma.propertyRoom.count({ where: { storeId: store.id, status: { in: ["DIRTY", "MAINTENANCE", "OUT_OF_SERVICE"] } } })
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
      // Sellers must never see unpaid/cancelled checkout attempts as orders
      // (see SELLER_VISIBLE_ORDER_STATUSES in lib/constants/order.ts).
      where: { storeId: store.id, status: { in: SELLER_VISIBLE_ORDER_STATUSES } },
      include: { buyer: true, items: { include: { product: true, service: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    productCapability
      ? prisma.orderItem.groupBy({
          by: ["productId"],
          where: {
            productId: { not: null },
            order: { storeId: store.id, ...topSaleWhere },
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
            order: { storeId: store.id, ...topSaleWhere },
          },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 5,
        })
      : Promise.resolve([]),
    // Restaurant "Kitchen Status" card: real kitchen pipeline counts for
    // today's paid orders. kitchenStatus defaults to QUEUED even on unpaid
    // checkouts, so the paid-status filter is required.
    isRestaurant
      ? prisma.order.groupBy({
          by: ["kitchenStatus"],
          where: { storeId: store.id, createdAt: { gte: dayStart, lt: dayEnd }, status: { in: PAID_ORDER_STATUSES } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const kitchenCount = (...statuses: string[]) =>
    kitchenGroups.filter((g) => statuses.includes(g.kitchenStatus)).reduce((sum, g) => sum + g._count._all, 0);

  const insights = insightsResult ?? EMPTY_INSIGHTS;
  const analyticsHidden = !(await analyticsAccessPromise).success;

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
          where: { productId: { in: topProductIds }, order: { storeId: store.id, ...topSaleWhere } },
          select: { productId: true, quantity: true, unitPrice: true },
        })
      : Promise.resolve([]),
    topServiceIds.length
      ? prisma.orderItem.findMany({
          where: { serviceId: { in: topServiceIds }, order: { storeId: store.id, ...topSaleWhere } },
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
            unitsSold: group._sum.quantity ?? 0,
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
            unitsSold: group._sum.quantity ?? 0,
            revenue: serviceRevenue.get(item.id) ?? 0,
          }
        : null;
    }),
  ]
    .filter((item): item is DashboardProduct => Boolean(item))
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
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
    roomAttentionCount,
    outOfStockCount,
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
      time: formatStoreTime(order.createdAt, tz),
    })),
    topProducts: topCatalog,
    bookings: todayBookings.map((booking): DashboardBooking => ({
      id: booking.id,
      time: formatStoreTime(booking.scheduledAt, tz),
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
    // Local hour (0-23) in the store's timezone, so the chart stops at "now"
    // instead of drawing the rest of the day as zero revenue.
    currentHour: Math.min(23, Math.floor(getLocalMinutes(now, tz) / 60)),
    analyticsHidden,
    kitchen: isRestaurant
      ? { waiting: kitchenCount("QUEUED"), preparing: kitchenCount("STARTED"), ready: kitchenCount("READY", "EXPO", "SERVED") }
      : undefined,
  };

  const checklist = await checklistPromise;
  const churnTip = await churnTipPromise;

  return (
    <>
      {churnTip && <ChurnTipCard slug={slug} {...churnTip} />}
      {checklist && (
        <FirstSaleChecklist
          slug={slug}
          storeName={store.name}
          publicUrl={checklist.publicUrl}
          steps={checklist.state.steps}
          doneCount={checklist.state.doneCount}
          total={checklist.state.total}
          complete={checklist.state.complete}
          listingNoun={checklist.state.listingNoun}
          ideas={checklist.ideas}
        />
      )}
      <AdaptiveDashboardHome
        slug={slug}
        storeName={store.name}
        userName={session.user.name}
        userImage={session.user.image}
        currency={store.currency}
        locale={store.locale}
        config={config}
        data={data}
      />
    </>
  );
}

// Same definition of "money received and kept" as getDashboardInsights.
const PAID_ORDER_STATUSES: OrderStatus[] = ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"];

const EMPTY_INSIGHTS: Pick<
  DashboardInsights,
  | "revenueToday" | "ordersToday" | "visitorsToday" | "conversionRate"
  | "revenueYesterday" | "ordersYesterday" | "newCustomersToday" | "newCustomersYesterday"
  | "avgOrderValueToday" | "avgOrderValueYesterday" | "hourlyRevenue"
> = {
  revenueToday: 0, ordersToday: 0, visitorsToday: 0, conversionRate: null,
  revenueYesterday: 0, ordersYesterday: 0, newCustomersToday: 0, newCustomersYesterday: 0,
  avgOrderValueToday: 0, avgOrderValueYesterday: 0,
  hourlyRevenue: new Array(24).fill(0),
};

function getOnboardingSubcategory(profile: unknown): string | null {
  if (!profile || typeof profile !== "object") return null;
  const value = (profile as Record<string, unknown>).subcategory;
  return typeof value === "string" ? value : null;
}

function formatStoreTime(date: Date, timeZone: string): string {
  return formatDate(date, { timeZone, hour: "numeric", minute: "2-digit" });
}

function formatOrderStatus(status: string): string {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}