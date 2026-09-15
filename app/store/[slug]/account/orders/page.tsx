import { notFound } from "next/navigation";
import Link from "next/link";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getAccountCopy } from "@/lib/account-copy";
import { prisma } from "@/lib/prisma";
import { OrdersListContent } from "../../orders/page";
import { VelouraAccountHero } from "@/components/storefront/veloura-account-shell";
import { getHotelContent } from "@/lib/hotel-content";

export default async function AccountOrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [store, record, hotel] = await Promise.all([
    getStoreBranding(slug),
    prisma.store.findUnique({ where: { slug }, select: { template: { select: { name: true } } } }),
    getHotelContent(slug),
  ]);
  if (!store) notFound();
  const copy = getAccountCopy(record?.template?.name, store.businessCategory);
  const hero = hotel.rooms.find((r: any) => r.featured)?.image || hotel.rooms[0]?.image || null;

  return (
    <div className="veloura-account-content">
      <VelouraAccountHero title={`My ${copy.orders}`} subtitle="Keep track of purchases, payments and order status from this store." image={hero} />
      <div className="bn-account-subpage-heading">
        <div><span>ORDER HISTORY</span><h2>Your {copy.orders.toLowerCase()}</h2></div>
        <Link href={`/store/${slug}`}>Continue shopping →</Link>
      </div>
      <OrdersListContent slug={slug} />
    </div>
  );
}
