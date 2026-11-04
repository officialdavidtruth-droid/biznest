// Route: /store/[slug]/offers
// Hotels keep their offers page; every other business sends shoppers to the catalog.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isHotelStore } from "@/lib/storefront-routing";
import HotelPage from "../hotel-page";

export default async function OffersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  const hotel = isHotelStore({ businessCategory: store.business?.category, storeBusinessType: store.businessType, templateName: store.template?.name });
  if (!hotel) redirect(`/store/${slug}/catalog`);
  return <HotelPage slug={slug} />;
}
