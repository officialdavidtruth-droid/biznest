"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { PageContent } from "@/lib/actions/pages-constants";
import { assertStorePermission } from "@/lib/access/assert-store-access";

// Folders under app/store/[slug]/ (plus a few reserved files). A static route always wins over
// the dynamic /[pageSlug] route, so a custom page saved under one of these slugs could never be
// reached. The six suggested slugs (about, gallery, faq, blog, contact, policies) are exempt here;
// see the audit notes for which of them actually render saved content.
const UNREACHABLE_PAGE_SLUGS = new Set([
  "home", "account", "admin", "amenities", "book", "booking", "brands", "cart", "catalog", "categories",
  "category", "checkout", "deals", "dining", "events", "experiences", "facilities", "favorites",
  "new-arrivals", "offers", "orders", "payment", "portfolio", "pricing", "product", "pwa-icon",
  "reservations", "review", "reviews", "rooms", "search", "service", "services", "start-project",
  "support", "wallet-pay", "manifest.webmanifest", "robots.txt", "sitemap.xml", "sw.js", "api",
]);

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
export async function saveStorePage(slug: string, formData: FormData): Promise<ActionResult<{ id: string; slug: string }>> {
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
  if (UNREACHABLE_PAGE_SLUGS.has(pageSlug)) return { success: false, error: `"${pageSlug}" is already used by a built-in store page. Choose a different URL slug.` };

  const content: PageContent = { body };

  const saved = await prisma.storePage.upsert({
    where: { storeId_slug: { storeId: access.store.id, slug: pageSlug } },
    update: { title, content, isPublished },
    create: { storeId: access.store.id, slug: pageSlug, title, content, isPublished },
    select: { id: true, slug: true },
  });

  revalidatePath(`/store/${slug}/admin/customize`);
  revalidatePath(`/store/${slug}/${pageSlug}`);
  return { success: true, data: { id: saved.id, slug: saved.slug } };
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
