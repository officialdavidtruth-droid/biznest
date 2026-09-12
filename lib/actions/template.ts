"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { seedSampleListings } from "@/lib/actions/store";
import { GRANDEUR_TEMPLATE_NAME, GRANDEUR_THEME } from "@/lib/template-themes";
import type { Prisma } from "@prisma/client";
import type { ActionResult } from "@/types/actions";

/** Only the new Grandeur template is selectable in the rebuilt catalog. */
export async function setStoreTemplate(slug: string, templateId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true, subscription: true } });
  if (!store) return { success: false, error: "Store not found." };
  if (store.business.userId !== session.user.id) return { success: false, error: "You don't have access to this store." };

  let template = await prisma.storeTemplate.findUnique({ where: { id: templateId } });
  if (!template && templateId === `__grandeur__:${GRANDEUR_TEMPLATE_NAME}`) {
    template = await prisma.storeTemplate.upsert({
      where: { name: GRANDEUR_TEMPLATE_NAME },
      update: { category: "Restaurant", isActive: true, tierRank: GRANDEUR_THEME.tierRank, config: GRANDEUR_THEME as unknown as Prisma.InputJsonValue },
      create: { name: GRANDEUR_TEMPLATE_NAME, category: "Restaurant", isActive: true, tierRank: GRANDEUR_THEME.tierRank, config: GRANDEUR_THEME as unknown as Prisma.InputJsonValue },
    });
  }

  if (!template || template.name !== GRANDEUR_TEMPLATE_NAME) {
    return { success: false, error: "That template has been retired. Only the new Grandeur Restaurant template is available." };
  }

  const features = store.subscription?.features as { templateTier?: number } | null;
  const planRank = features?.templateTier ?? 1;
  if (template.tierRank > planRank) return { success: false, error: "This template requires a higher plan." };

  await prisma.store.update({ where: { id: store.id }, data: { templateId: template.id } });
  await seedSampleListings(slug);

  revalidatePath(`/store/${slug}/admin/templates`);
  revalidatePath(`/store/${slug}/admin/builder`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: undefined };
}
