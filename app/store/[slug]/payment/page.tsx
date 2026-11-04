// Route: /store/[slug]/payment
// Restaurant stores keep their payment page; every other business pays through checkout.
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GrandeurPayment } from "@/components/storefront/grandeur-restaurant";
import { getGrandeurRestaurantData } from "@/lib/grandeur-restaurant";
import { isGrandeurStore } from "@/lib/store-pages";

export default async function PaymentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();
  if (!isGrandeurStore({ businessCategory: store.business?.category, storeBusinessType: store.businessType, templateName: store.template?.name })) redirect(`/store/${slug}/checkout`);
  const data = await getGrandeurRestaurantData(slug, { skinOnly: true });
  if (!data) notFound();
  return <GrandeurPayment store={data.store} slug={slug} />;
}
