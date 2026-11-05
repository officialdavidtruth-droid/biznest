import "server-only";
import { prisma } from "@/lib/prisma";
import { HOTEL_TEMPLATE_NAME } from "@/lib/hotel-content";

/** The hotel "Veloura" account skin keeps its own look; every other store uses the modern account design. */
export async function isHotelAccount(slug: string): Promise<boolean> {
  const row = await prisma.store.findUnique({ where: { slug }, select: { template: { select: { name: true } } } });
  return row?.template?.name === HOTEL_TEMPLATE_NAME;
}
