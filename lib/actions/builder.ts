"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { builderConfigSchema, type BuilderConfig } from "@/lib/builder-config";
import type { ActionResult } from "@/types/actions";

async function assertStoreAccess(slug: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "You must be signed in." };
  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false as const, error: "Store not found." };
  const isOwner = store.business.userId === session.user.id;
  const isStaff = session.user.role === "PLATFORM_ADMIN" || session.user.role === "SUPPORT_MODERATOR";
  if (!isOwner && !isStaff) return { success: false as const, error: "You don't have access to this store." };
  return { success: true as const, store };
}

export async function saveBuilderConfig(slug: string, config: BuilderConfig): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };
  const parsed = builderConfigSchema.safeParse(config);
  if (!parsed.success) return { success: false, error: "Invalid website builder configuration." };

  const current = (access.store.sectionOverrides as Record<string, unknown> | null) ?? {};
  await prisma.store.update({
    where: { id: access.store.id },
    data: {
      sectionOverrides: {
        ...current,
        builderVersion: 1,
        builder: parsed.data,
        order: parsed.data.sections.map((s) => s.id),
        hidden: parsed.data.sections.filter((s) => !s.visible).map((s) => s.id),
      },
    },
  });

  revalidatePath(`/store/${slug}`);
  revalidatePath(`/store/${slug}/admin/customize`);
  return { success: true, data: undefined };
}

export async function activateVisualBuilder(slug: string, config: BuilderConfig): Promise<ActionResult> {
  return saveBuilderConfig(slug, config);
}

export async function updateStoreSeo(slug: string, seoTitle: string, seoDescription: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };
  const title = seoTitle.trim().slice(0, 70);
  const description = seoDescription.trim().slice(0, 160);
  if (!title) return { success: false, error: "SEO title is required." };
  await prisma.store.update({ where: { id: access.store.id }, data: { seoTitle: title, seoDescription: description || null } });
  revalidatePath(`/store/${slug}`);
  revalidatePath(`/store/${slug}/admin/customize`);
  return { success: true, data: undefined };
}
