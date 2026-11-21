// Route: /store/[slug]/reservations
// Table reservations exist for restaurant businesses only (decided by the business, never by the template's name).
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GrandeurReservations } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
import { isGrandeurStore, usesRestaurantSkin } from "@/lib/store-pages";
import { getReserveInfo } from "@/lib/actions/table-reservations";
import { RestaurantReservations } from "@/components/storefront/restaurant-reservations";

export default async function ReservationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  if (!isGrandeurStore({ businessCategory: store.business?.category, storeBusinessType: store.businessType, templateName: store.template?.name })) notFound();
  if (usesRestaurantSkin({ businessCategory: store.business?.category, businessSubcategory: store.business?.businessSubcategory, storeBusinessType: store.businessType, templateName: store.template?.name })) {
    const info = await getReserveInfo(slug);
    if (!info) notFound();
    const first = await prisma.product.findFirst({ where: { storeId: store.id, isPublished: true, images: { isEmpty: false } }, select: { images: true } });
    return <RestaurantReservations store={store} slug={slug} info={info} image={first?.images[0] ?? null} />;
  }
  const data = await getGrandeurRestaurantData(slug, { skinOnly: true });
  if (!data) notFound();
  return <GrandeurReservations store={data.store} slug={slug} items={data.items} />;
}
