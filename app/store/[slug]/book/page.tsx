import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { storeBasePath } from "@/lib/store-pwa";
import HotelPage from "../hotel-page";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Restaurants that have listed their tables take reservations by date, time and party size.
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, businessType: true } });
  if (store?.businessType === "Restaurant" && (await prisma.fnbTable.count({ where: { storeId: store.id, active: true } })) > 0) redirect(`${storeBasePath((await headers()).get("host"), slug)}/reserve`);
  return <HotelPage slug={slug} />;
}
