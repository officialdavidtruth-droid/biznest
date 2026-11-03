"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { sanitizeCustomUrl, MENU_PAGE_OPTIONS, type MenuLinkType } from "@/lib/storefront-menu";
import { hasPageContent } from "@/lib/storefront/page-blocks";
import { filterAvailablePages, isStorePageAvailable, type StoreIdentity } from "@/lib/store-pages";
import type { ActionResult } from "@/types/actions";

export type MenuNodeInput = {
  /** Present for items that already exist; keeps their id stable across saves. Unknown ids are ignored. */
  id?: string;
  label: string;
  linkType: MenuLinkType;
  target?: string | null;
  openInNewTab?: boolean;
  children?: MenuNodeInput[];
};

const MAX_TOP = 12;
const MAX_CHILDREN = 20;

async function getStoreIdentity(storeId: string): Promise<StoreIdentity> {
  const s = await prisma.store.findUnique({
    where: { id: storeId },
    select: { businessType: true, business: { select: { category: true } }, template: { select: { name: true } } },
  });
  return { businessCategory: s?.business?.category ?? null, storeBusinessType: s?.businessType ?? null, templateName: s?.template?.name ?? null };
}

/** Slugs of published pages that have real owner-written text. */
function writtenPageSet(rows: { slug: string; content: unknown }[]): Set<string> {
  return new Set(rows.filter((r) => hasPageContent(r.content)).map((r) => r.slug));
}

async function access(slug: string) {
  const a = await assertStorePermission(slug, "settings");
  if (!a.success) return a;
  if (a.role === "STAFF") return { success: false as const, error: "Only the owner or a manager can edit the menu." };
  return a;
}

export async function getMenuEditorData(slug: string) {
  const a = await access(slug);
  if (!a.success) return { error: a.error };
  const [rows, categories, storePages] = await Promise.all([
    prisma.storeMenuItem.findMany({
      where: { storeId: a.store.id, location: "header" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, linkType: true, target: true, openInNewTab: true, parentId: true, sortOrder: true },
    }),
    prisma.category.findMany({
      where: { storeId: a.store.id, isActive: true },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
      select: { id: true, name: true, parentId: true },
    }),
    prisma.storePage.findMany({
      where: { storeId: a.store.id, isPublished: true },
      orderBy: { title: "asc" },
      select: { slug: true, title: true, content: true },
    }),
  ]);
  // Pages the owner created in the Pages panel that aren't already built-in options.
  const builtIn = new Set(MENU_PAGE_OPTIONS.map((p) => p.path));
  // Only pages with real owner-written content: template content rows and empty placeholders are not pages.
  const pages = storePages
    .filter((p: { slug: string; content: unknown }) => !builtIn.has(`/${p.slug}`) && p.slug !== "home" && hasPageContent(p.content))
    .map((p: { slug: string; title: string }) => ({ slug: p.slug, title: p.title }));

  const tree: MenuNodeInput[] = rows
    .filter((r) => !r.parentId)
    .map((r) => ({
      id: r.id,
      label: r.label,
      linkType: r.linkType as MenuLinkType,
      target: r.target,
      openInNewTab: r.openInNewTab,
      children: rows
        .filter((c) => c.parentId === r.id)
        .map((c) => ({ id: c.id, label: c.label, linkType: c.linkType as MenuLinkType, target: c.target, openInNewTab: c.openInNewTab })),
    }));

  // Only offer built-in pages this store really has: its skin serves them, or the owner wrote and published them
  // (Blog and a non-template Gallery exist only once written).
  const written = writtenPageSet(storePages);
  const pageOptions = filterAvailablePages(MENU_PAGE_OPTIONS, await getStoreIdentity(a.store.id), written);

  return { tree, categories, pages, pageOptions, hasCustomMenu: rows.length > 0, storeName: a.store.name };
}

function validateNode(n: MenuNodeInput, categoryIds: Set<string>, pagePaths: Set<string>, identity: StoreIdentity, written: ReadonlySet<string>): string | null {
  const label = n.label?.trim();
  if (!label) return "Every menu item needs a label.";
  if (label.length > 40) return `"${label.slice(0, 20)}…" is too long (max 40 characters).`;
  if (n.linkType === "PAGE") {
    if (!MENU_PAGE_OPTIONS.some((p) => p.path === (n.target || "/")) && !pagePaths.has(n.target || "/")) return `"${label}" points to an unknown page.`;
    if (!isStorePageAvailable(n.target || "/", identity, written)) return `"${label}" links to a page your store doesn't have. Remove it or pick another page.`;
  } else if (n.linkType === "CATEGORY") {
    if (!n.target || !categoryIds.has(n.target)) return `"${label}" points to a category that no longer exists.`;
  } else if (n.linkType === "CUSTOM") {
    if (!n.target || !sanitizeCustomUrl(n.target)) return `"${label}" needs a valid link (https://…, /path, #section, mailto: or tel:).`;
  } else return `"${label}" has an invalid link type.`;
  return null;
}

export async function saveStoreMenu(slug: string, tree: MenuNodeInput[]): Promise<ActionResult<MenuNodeInput[]>> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  if (!Array.isArray(tree) || tree.length === 0) return { success: false, error: "Add at least one menu item, or use Reset to go back to the template default." };
  if (tree.length > MAX_TOP) return { success: false, error: `A menu can have at most ${MAX_TOP} top-level items.` };

  const cats = await prisma.category.findMany({ where: { storeId: a.store.id }, select: { id: true } });
  const categoryIds = new Set<string>(cats.map((c: { id: string }) => c.id));
  const pageRows = await prisma.storePage.findMany({ where: { storeId: a.store.id, isPublished: true }, select: { slug: true, content: true } });
  const written = writtenPageSet(pageRows);
  const pagePaths = new Set<string>(pageRows.filter((p: { content: unknown }) => hasPageContent(p.content)).map((p: { slug: string }) => `/${p.slug}`));

  const identity = await getStoreIdentity(a.store.id);
  for (const n of tree) {
    const err = validateNode(n, categoryIds, pagePaths, identity, written);
    if (err) return { success: false, error: err };
    if ((n.children?.length ?? 0) > MAX_CHILDREN) return { success: false, error: `"${n.label}" has too many dropdown items (max ${MAX_CHILDREN}).` };
    for (const c of n.children ?? []) {
      const cerr = validateNode(c, categoryIds, pagePaths, identity, written);
      if (cerr) return { success: false, error: cerr };
    }
  }

  // Update in place instead of wiping and recreating: an item the owner kept keeps its id (and createdAt), only
  // genuinely new items are inserted, and only items the owner removed are deleted. Ids from the request are trusted
  // only if they are this store's header items, and each id can be claimed once.
  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.storeMenuItem.findMany({ where: { storeId: a.store.id, location: "header" }, select: { id: true } });
    const existingIds = new Set(existing.map((e) => e.id));
    const kept = new Set<string>();
    let order = 0;

    const write = async (n: MenuNodeInput, parentId: string | null): Promise<MenuNodeInput> => {
      const data = {
        label: n.label.trim(),
        linkType: n.linkType,
        target: n.linkType === "CUSTOM" ? sanitizeCustomUrl(n.target ?? "") : n.target || (n.linkType === "PAGE" ? "/" : null),
        openInNewTab: !!n.openInNewTab,
        parentId,
        sortOrder: order++,
        isActive: true,
      };
      let id: string;
      if (n.id && existingIds.has(n.id) && !kept.has(n.id)) {
        await tx.storeMenuItem.update({ where: { id: n.id }, data });
        id = n.id;
      } else {
        id = (await tx.storeMenuItem.create({ data: { storeId: a.store.id, location: "header", ...data }, select: { id: true } })).id;
      }
      kept.add(id);
      return { id, label: data.label, linkType: n.linkType, target: data.target, openInNewTab: data.openInNewTab };
    };

    const out: MenuNodeInput[] = [];
    for (const n of tree) {
      const top = await write(n, null);
      const children: MenuNodeInput[] = [];
      for (const c of n.children ?? []) children.push(await write(c, top.id as string));
      out.push({ ...top, children });
    }
    // Children the owner kept were re-parented above, so deleting a removed parent cannot cascade onto them.
    await tx.storeMenuItem.deleteMany({ where: { storeId: a.store.id, location: "header", id: { notIn: [...kept] } } });
    return out;
  });

  revalidatePath(`/store/${slug}`, "layout");
  return { success: true, data: saved };
}

export async function resetStoreMenu(slug: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  await prisma.storeMenuItem.deleteMany({ where: { storeId: a.store.id, location: "header" } });
  revalidatePath(`/store/${slug}`, "layout");
  return { success: true, data: undefined };
}
