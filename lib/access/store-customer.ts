import "server-only";
import { prisma } from "@/lib/prisma";

/** True when this user is a known customer of the store (has a customer profile or has ordered there). */
export async function isCustomerOfStore(storeId: string, userId: string): Promise<boolean> {
  const [profile, order] = await Promise.all([
    prisma.storeCustomerProfile.findFirst({ where: { storeId, userId }, select: { id: true } }),
    prisma.order.findFirst({ where: { storeId, buyerId: userId }, select: { id: true } }),
  ]);
  return Boolean(profile || order);
}
