import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import { RecoverOrderForm } from "@/components/forms/recover-order-form";
import { getHotelContent } from "@/lib/hotel-content";
import { VelouraAccountHero } from "@/components/storefront/veloura-account-shell";

export default async function RecoverOrderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [store, hotel] = await Promise.all([getStoreBranding(slug), getHotelContent(slug)]);
  if (!store) notFound();
  const membership = await requireStoreCustomer(slug);
  if (!membership) notFound();
  return <div className="veloura-account-content"><VelouraAccountHero title="Recover an Order" subtitle="If you placed an order but it is not showing here, use your order details to recover it." image={hotel.rooms[0]?.image || null}/><div className="bn-account-recover"><Link href={`/store/${slug}/account/orders`}><ArrowLeft size={15}/> Back to orders</Link><div className="bn-account-recover-card"><h2>Find your order</h2><p>Enter the requested order information and we’ll securely match it to your account.</p><RecoverOrderForm storeSlug={slug} storeName={store.name}/></div></div></div>;
}
