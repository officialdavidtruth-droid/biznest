import "server-only";
import { prisma } from "@/lib/prisma";
import { decodePlatformUnsubscribeToken } from "@/lib/email/platform-unsubscribe";

export async function performPlatformUnsubscribe(token: string | undefined | null): Promise<{ success: boolean }> {
  const decoded = decodePlatformUnsubscribeToken(token);
  if (!decoded) return { success: false };
  await prisma.user.updateMany({
    where: { id: decoded.userId, platformEmailOptOutAt: null },
    data: { platformEmailOptOutAt: new Date() },
  });
  return { success: true };
}
