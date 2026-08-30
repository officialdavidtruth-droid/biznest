"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { PageContent } from "@/lib/actions/pages-constants";
import { assertStorePermission } from "@/lib/access/assert-store-access";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

// Custom pages live under the website builder/customize area ("settings"
// permission in dashboard-nav.ts).
async function assertStoreAccess(slug: string) {
  return assertStorePermission(slug, "settings");
}

/**
 * Create a page, or update it in place if a page with that slug already
 * exists for this store (the @@unique([storeId, slug]) constraint on
 * StorePage makes this a natural upsert). Used both for the six suggested
 * pages (first save on one of them creates it) and for custom slugs.
 */
export async function saveStorePage(slug: string, formData: FormData): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const rawSlug = String(formData.get("pageSlug") ?? "");
  const pageSlug = slugify(rawSlug);
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const isPublished = formData.get("isPublished") === "on";

  if (!pageSlug) return { success: false, error: "This page needs a URL slug." };
  if (!title) return { success: false, error: "This page needs a title." };
  if (pageSlug === "home") return { success: false, error: "\"home\" is reserved for the homepage." };

  const content: PageContent = { body };

  await prisma.storePage.upsert({
    where: { storeId_slug: { storeId: access.store.id, slug: pageSlug } },
    update: { title, content, isPublished },
    create: { storeId: access.store.id, slug: pageSlug, title, content, isPublished },
  });

  revalidatePath(`/store/${slug}/admin/customize`);
  revalidatePath(`/store/${slug}/${pageSlug}`);
  return { success: true, data: undefined };
}

export async function toggleStorePagePublished(slug: string, pageId: string, isPublished: boolean): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const page = await prisma.storePage.findFirst({ where: { id: pageId, storeId: access.store.id } });
  if (!page) return { success: false, error: "Page not found." };

  await prisma.storePage.update({ where: { id: pageId }, data: { isPublished } });

  revalidatePath(`/store/${slug}/admin/customize`);
  revalidatePath(`/store/${slug}/${page.slug}`);
  return { success: true, data: undefined };
}

export async function deleteStorePage(slug: string, pageId: string): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const page = await prisma.storePage.findFirst({ where: { id: pageId, storeId: access.store.id } });
  if (!page) return { success: false, error: "Page not found." };

  await prisma.storePage.delete({ where: { id: pageId } });

  revalidatePath(`/store/${slug}/admin/customize`);
  revalidatePath(`/store/${slug}/${page.slug}`);
  return { success: true, data: undefined };
}
