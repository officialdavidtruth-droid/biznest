"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BROWSE_NOTIFY_TYPES } from "@/lib/browse-notify";
import type { ActionResult } from "@/types/actions";

/** Marks the signed-in person's Browse alerts as read. Other kinds of notification are left alone. */
export async function markBrowseNotificationsRead(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Sign in first." };
  await prisma.notification.updateMany({ where: { userId: session.user.id, type: { in: [...BROWSE_NOTIFY_TYPES] }, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/browse/notifications");
  return { success: true, data: undefined };
}
