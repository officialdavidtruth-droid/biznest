"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";

export async function setStoreTemplate(slug: string, templateId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false, error: "Store not found." };
  if (store.business.userId !== session.user.id) {
    return { success: false, error: "You don't have access to this store." };
  }

  const template = await prisma.storeTemplate.findUnique({ where: { id: templateId } });
  if (!template) return { success: false, error: "Template not found." };

  await prisma.store.update({ where: { id: store.id }, data: { templateId } });

  revalidatePath(`/store/${slug}/admin/builder`);
  return { success: true, data: undefined };
}
