import { notFound } from "next/navigation";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getStoreCustomerOverview, listStoreBookings, listStoreWishlist } from "@/lib/actions/account";
import { getStoreLoyaltySummary } from "@/lib/actions/loyalty";
import { getWallet } from "@/lib/actions/customer-wallet";
import { getHotelContent } from "@/lib/hotel-content";
import { VelouraAccountProfile } from "@/components/storefront/veloura-account-profile";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";

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
  const heroImage = hotel.rooms.find((r) => r.featured)?.image || hotel.rooms[0]?.image || store.bannerUrl || null;
  return <VelouraAccountProfile slug={slug} store={store} user={session.user} overview={overview} bookings={bookings} savedRooms={wishlist.filter((x:any)=>x.service)} wallet={wallet} loyalty={loyalty} heroImage={heroImage} />;
}
