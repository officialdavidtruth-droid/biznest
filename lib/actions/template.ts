"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { seedSampleListings } from "@/lib/actions/store";
import { SIGNATURE_TEMPLATE_CATALOG } from "@/lib/template-themes";
import type { Prisma } from "@prisma/client";
import type { ActionResult } from "@/types/actions";

export async function setStoreTemplate(slug: string, templateId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true, subscription: true } });
  if (!store) return { success: false, error: "Store not found." };
  if (store.business.userId !== session.user.id) {
    return { success: false, error: "You don't have access to this store." };
  }

  // Signature templates are part of the application catalog, not just the
  // seed data. Vercel builds do not automatically run `db:seed`, so create
  // the selected Signature template on demand the first time a vendor picks
  // it. The gallery uses this stable virtual id for rows that are not in the
  // database yet.
  let template = await prisma.storeTemplate.findUnique({ where: { id: templateId } });
  if (!template && templateId.startsWith("__signature__:")) {
    const name = templateId.slice("__signature__:".length);
    const signature = SIGNATURE_TEMPLATE_CATALOG.find((t) => t.variationName === name);
    if (!signature) return { success: false, error: "Template not found." };

    const tierRank = ["kinetic", "maison", "north", "forge"].includes(signature.signatureMode) ? 4 : 3;
    template = await prisma.storeTemplate.upsert({
      where: { name: signature.variationName },
      update: {
        category: signature.signatureMode,
        isActive: true,
        tierRank,
        config: signature as unknown as Prisma.InputJsonValue,
      },
      create: {
        name: signature.variationName,
        category: signature.signatureMode,
        isActive: true,
        tierRank,
        config: signature as unknown as Prisma.InputJsonValue,
      },
    });
  }
  if (!template) return { success: false, error: "Template not found." };

  // Enforced here, not just in the gallery UI — a locked template must
  // actually be unselectable, not just visually greyed out. The gallery's
  // lock icon is a convenience; this check is what actually matters.
  const features = store.subscription?.features as { templateTier?: number } | null;
  const planRank = features?.templateTier ?? 1;
  if (template.tierRank > planRank) {
    return { success: false, error: "This template requires a higher plan. Upgrade in Subscription to unlock it." };
  }

  await prisma.store.update({ where: { id: store.id }, data: { templateId: template.id } });

  // Switching templates previously never touched listings — a store that
  // switched from an empty state (or was created before sample seeding
  // existed) stayed empty after switching too, which is exactly what made
  // the new template look "plain" with no demo content. seedSampleListings
  // is a no-op if the store already has real listings — never overwrites them.
  await seedSampleListings(slug);

  revalidatePath(`/store/${slug}/admin/builder`);
  revalidatePath(`/store/${slug}`);
  return { success: true, data: undefined };
}
