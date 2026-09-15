import { notFound } from "next/navigation";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { listStoreAddresses } from "@/lib/actions/account";
import { StoreAddressManager } from "@/components/account/store-address-manager";
import { getHotelContent } from "@/lib/hotel-content";
import { VelouraAccountHero } from "@/components/storefront/veloura-account-shell";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [store, addresses, hotel] = await Promise.all([getStoreBranding(slug), listStoreAddresses(slug), getHotelContent(slug)]);
  if (!store) notFound();
  const hero = hotel.rooms[0]?.image || null;
  return <div className="veloura-account-content"><VelouraAccountHero title="My Addresses" subtitle="Manage the addresses saved for your account at this store." image={hero}/><StoreAddressManager storeSlug={slug} initialAddresses={addresses}/></div>;
}
