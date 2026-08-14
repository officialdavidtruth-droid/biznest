"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function listMyNotifications(limit = 15) {
  const session = await auth();
  if (!session?.user?.id) return { notifications: [], unreadCount: 0 };

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
  ]);

  return { notifications, unreadCount };
}

export async function markNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}
