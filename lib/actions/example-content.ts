"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import type { ActionResult } from "@/types/actions";
import { DEFAULT_EXAMPLE_CONTENT, EXAMPLE_TEMPLATE_NAME, type ExampleContent } from "@/lib/example-content";

export async function saveExampleContent(slug: string, content: Partial<ExampleContent>): Promise<ActionResult> {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return access;
  const current = (access.store.sectionOverrides as Record<string, unknown> | null) ?? {};
  const clean = { ...DEFAULT_EXAMPLE_CONTENT, ...content };
  await prisma.store.update({
    where: { id: access.store.id },
    data: { sectionOverrides: { ...current, exampleContent: clean } },
  });
  revalidatePath(`/store/${slug}`);
  revalidatePath(`/store/${slug}/categories`);
  revalidatePath(`/store/${slug}/deals`);
  revalidatePath(`/store/${slug}/new-arrivals`);
  revalidatePath(`/store/${slug}/brands`);
  revalidatePath(`/store/${slug}/admin/example`);
  return { success: true, data: undefined };
}

export async function ensureExampleTemplate(slug: string) {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return access;
  const template = await prisma.storeTemplate.findUnique({ where: { name: EXAMPLE_TEMPLATE_NAME }, select: { id: true } });
  if (template) await prisma.store.update({ where: { id: access.store.id }, data: { templateId: template.id } });
  revalidatePath(`/store/${slug}`);
  return { success: true, data: undefined };
}
