"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { RESERVED_PAGE_SLUGS, type PageContent } from "@/lib/actions/pages-constants";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { isPlaceholderContent, ownerPageBody } from "@/lib/storefront/page-registry";
import { blocksToPlainText, pageUsesBlocks, sanitizeBlocks } from "@/lib/storefront/page-blocks";

const PAGE_TITLE_MAX = 120;
const PAGE_BODY_MAX = 20000;

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
  let body = String(formData.get("body") ?? "").trim();
  const isPublished = formData.get("isPublished") === "on";

  if (!pageSlug) return { success: false, error: "This page needs a URL slug." };
  if (!title) return { success: false, error: "This page needs a title." };
  if (title.length > PAGE_TITLE_MAX) return { success: false, error: `The title is too long (max ${PAGE_TITLE_MAX} characters).` };
  if (pageSlug === "home") return { success: false, error: "\"home\" is reserved for the homepage." };
  if (RESERVED_PAGE_SLUGS.has(pageSlug)) return { success: false, error: `"${pageSlug}" is already used by a built-in store page. Choose a different URL slug.` };

  // Pages with a fixed text format (FAQ, Policies, Gallery, Blog) store text only. Every other page stores blocks,
  // plus `body`, their plain-text version, which keeps everything that reads text working.
  const rawBlocks = String(formData.get("blocks") ?? "");
  if (rawBlocks.length > 200_000) return { success: false, error: "This page is too large. Split it into two pages." };
  let parsed: unknown = [];
  try { parsed = rawBlocks ? JSON.parse(rawBlocks) : []; } catch { return { success: false, error: "The page content could not be read. Reload and try again." }; }
  const blocks = pageUsesBlocks(pageSlug) ? sanitizeBlocks(parsed) : [];
  if (blocks.length > 0) body = blocksToPlainText(blocks);
  else if (!body) body = blocksToPlainText(sanitizeBlocks(parsed));

  if (body.length > PAGE_BODY_MAX) return { success: false, error: `This page is too long (max ${PAGE_BODY_MAX.toLocaleString("en")} characters of text). Split it into two pages.` };
  if (!body && blocks.length === 0) return { success: false, error: "Add something to this page before saving it." };

  const content: PageContent = blocks.length > 0 ? { body, blocks } : { body };

  // Template editors (hotel sections, events, template galleries) keep their own content in this table under
  // plain slugs. Never overwrite one with a text page.
  const existing = await prisma.storePage.findUnique({ where: { storeId_slug: { storeId: access.store.id, slug: pageSlug } }, select: { content: true } });
  if (existing && ownerPageBody(existing.content) === null && !isPlaceholderContent(existing.content)) {
    return { success: false, error: `"${pageSlug}" is managed by your template's own editor. Use a different URL slug for a text page.` };
  }

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
  // A menu link to this page follows its published state, so the header never links to a 404.
  await prisma.storeMenuItem.updateMany({ where: { storeId: access.store.id, linkType: "PAGE", target: `/${page.slug}` }, data: { isActive: isPublished } });

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
  await prisma.storeMenuItem.updateMany({ where: { storeId: access.store.id, linkType: "PAGE", target: `/${page.slug}` }, data: { isActive: false } });

  revalidatePath(`/store/${slug}/admin/customize`);
  revalidatePath(`/store/${slug}/${page.slug}`);
  return { success: true, data: undefined };
}
