import { notFound } from "next/navigation";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getStoreCustomerOverview, listStoreBookings, listStoreWishlist } from "@/lib/actions/account";
import { getStoreLoyaltySummary } from "@/lib/actions/loyalty";
import { getWallet } from "@/lib/actions/customer-wallet";
import { getHotelContent } from "@/lib/hotel-content";
import { VelouraAccountProfile } from "@/components/storefront/veloura-account-profile";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { HOTEL_TEMPLATE_NAME } from "@/lib/hotel-content";
import { prisma } from "@/lib/prisma";
import { StoreAccountProfile } from "@/components/account/store-account-profile";
import { formatDate, formatNumber } from "@/lib/i18n/locale";
import { getAccountCopy } from "@/lib/account-copy";

export default async function StoreAccountOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [store, session, overview, bookings, wishlist, loyalty, wallet, hotel] = await Promise.all([
    getStoreBranding(slug),
    getStoreCustomerSessionForStore(slug),
    getStoreCustomerOverview(slug),
    listStoreBookings(slug),
    listStoreWishlist(slug),
    getStoreLoyaltySummary(slug),
    getWallet(slug),
    getHotelContent(slug),
  ]);
  if (!store || !session?.user || !overview) notFound();
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, phone: true, createdAt: true } });
  const tpl = await prisma.store.findUnique({ where: { slug }, select: { template: { select: { name: true } } } });
  if (tpl?.template?.name !== HOTEL_TEMPLATE_NAME) {
    // Hotel stores keep the stay-focused profile below; every other business gets a neutral one with real details editing.
    const copy = getAccountCopy(null, store.businessCategory);
    const addr = overview.defaultAddress as { city?: string | null; state?: string | null } | null;
    const stats = [
      ...(store.sellsProducts ? [{ label: copy.orders, value: overview.orderCount }] : []),
      ...(store.offersServices ? [{ label: copy.bookings, value: overview.bookingCount }] : []),
      { label: copy.wishlist, value: overview.wishlistCount },
      { label: "Reward points", value: formatNumber(Number(loyalty?.pointsBalance ?? overview.pointsBalance ?? 0)) },
    ];
    const links = [
      ...(store.sellsProducts ? [{ href: `/store/${slug}/orders`, label: copy.orders, hint: "Track and review what you've bought." }] : []),
      ...(store.offersServices ? [{ href: `/store/${slug}/account/bookings`, label: copy.bookings, hint: "See upcoming and past bookings." }] : []),
      ...(store.sellsProducts ? [{ href: `/store/${slug}/account/addresses`, label: "Addresses", hint: "Where we deliver to." }] : []),
      { href: `/store/${slug}/account/wallet`, label: "Wallet", hint: wallet ? `Balance ${wallet.currency || "NGN"} ${formatNumber(Number(wallet.balance))}` : "Your store credit." },
      { href: `/store/${slug}/account/messages`, label: "Support & messages", hint: `Talk to ${store.name}.` },
    ];
    return <StoreAccountProfile slug={slug} storeName={store.name} user={{ name: me?.name ?? session.user.name, email: me?.email ?? session.user.email, phone: me?.phone ?? null }} stats={stats} links={links}
      location={addr ? [addr.city, addr.state].filter(Boolean).join(", ") || null : null}
      memberSince={me?.createdAt ? formatDate(me.createdAt, { day: "2-digit", month: "short", year: "numeric" }) : "—"} />;
  }
  const heroImage = hotel.rooms.find((r) => r.featured)?.image || hotel.rooms[0]?.image || store.logoUrl || null;
  return <VelouraAccountProfile slug={slug} store={store} user={{ ...session.user, phone: me?.phone ?? null, createdAt: me?.createdAt ?? null }} overview={overview} bookings={bookings} savedRooms={wishlist.filter((x:any)=>x.service)} wallet={wallet} loyalty={loyalty} heroImage={heroImage} />;
}