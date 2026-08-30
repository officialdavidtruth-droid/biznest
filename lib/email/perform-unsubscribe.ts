import "server-only";
import { prisma } from "@/lib/prisma";
import { decodeUnsubscribeToken } from "@/lib/email/unsubscribe-token";

export async function performUnsubscribe(token: string | undefined | null): Promise<{ success: boolean; storeName: string }> {
  const decoded = token ? decodeUnsubscribeToken(token) : null;
  if (!decoded) return { success: false, storeName: "this business" };

  const subscriber = await prisma.newsletterSubscriber.findFirst({
    where: { storeId: decoded.storeId, email: decoded.email },
    include: { store: { select: { name: true } } },
  });
  if (!subscriber) return { success: false, storeName: "this business" };

  if (!subscriber.unsubscribedAt) {
    await prisma.newsletterSubscriber.update({ where: { id: subscriber.id }, data: { unsubscribedAt: new Date() } });
  }
  return { success: true, storeName: subscriber.store.name };
}
