"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { sanitizeCustomUrl, MENU_PAGE_OPTIONS, type MenuLinkType } from "@/lib/storefront-menu";
import type { ActionResult } from "@/types/actions";

export type MenuNodeInput = {
  label: string;
  linkType: MenuLinkType;
  target?: string | null;
  openInNewTab?: boolean;
  children?: MenuNodeInput[];
};

const MAX_TOP = 12;
const MAX_CHILDREN = 20;

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
      select: { slug: true, title: true },
    }),
  ]);
  // Pages the owner created in the Pages panel that aren't already built-in options.
  const builtIn = new Set(MENU_PAGE_OPTIONS.map((p) => p.path));
  const pages = storePages.filter((p: { slug: string }) => !builtIn.has(`/${p.slug}`) && p.slug !== "home");

  const tree: MenuNodeInput[] = rows
    .filter((r) => !r.parentId)
    .map((r) => ({
      label: r.label,
      linkType: r.linkType as MenuLinkType,
      target: r.target,
      openInNewTab: r.openInNewTab,
      children: rows
        .filter((c) => c.parentId === r.id)
        .map((c) => ({ label: c.label, linkType: c.linkType as MenuLinkType, target: c.target, openInNewTab: c.openInNewTab })),
    }));

  return { tree, categories, pages, hasCustomMenu: rows.length > 0, storeName: a.store.name };
}

function validateNode(n: MenuNodeInput, categoryIds: Set<string>, pagePaths: Set<string>): string | null {
  const label = n.label?.trim();
  if (!label) return "Every menu item needs a label.";
  if (label.length > 40) return `"${label.slice(0, 20)}…" is too long (max 40 characters).`;
  if (n.linkType === "PAGE") {
    if (!MENU_PAGE_OPTIONS.some((p) => p.path === (n.target || "/")) && !pagePaths.has(n.target || "/")) return `"${label}" points to an unknown page.`;
  } else if (n.linkType === "CATEGORY") {
    if (!n.target || !categoryIds.has(n.target)) return `"${label}" points to a category that no longer exists.`;
  } else if (n.linkType === "CUSTOM") {
    if (!n.target || !sanitizeCustomUrl(n.target)) return `"${label}" needs a valid link (https://…, /path, #section, mailto: or tel:).`;
  } else return `"${label}" has an invalid link type.`;
  return null;
}

export async function saveStoreMenu(slug: string, tree: MenuNodeInput[]): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  if (!Array.isArray(tree) || tree.length === 0) return { success: false, error: "Add at least one menu item, or use Reset to go back to the template default." };
  if (tree.length > MAX_TOP) return { success: false, error: `A menu can have at most ${MAX_TOP} top-level items.` };

  const cats = await prisma.category.findMany({ where: { storeId: a.store.id }, select: { id: true } });
  const categoryIds = new Set<string>(cats.map((c: { id: string }) => c.id));
  const pageRows = await prisma.storePage.findMany({ where: { storeId: a.store.id, isPublished: true }, select: { slug: true } });
  const pagePaths = new Set<string>(pageRows.map((p: { slug: string }) => `/${p.slug}`));

  for (const n of tree) {
    const err = validateNode(n, categoryIds, pagePaths);
    if (err) return { success: false, error: err };
    if ((n.children?.length ?? 0) > MAX_CHILDREN) return { success: false, error: `"${n.label}" has too many dropdown items (max ${MAX_CHILDREN}).` };
    for (const c of n.children ?? []) {
      const cerr = validateNode(c, categoryIds, pagePaths);
      if (cerr) return { success: false, error: cerr };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.storeMenuItem.deleteMany({ where: { storeId: a.store.id, location: "header" } });
    let order = 0;
    for (const n of tree) {
      const parent = await tx.storeMenuItem.create({
        data: {
          storeId: a.store.id, location: "header", label: n.label.trim(), linkType: n.linkType,
          target: n.linkType === "CUSTOM" ? sanitizeCustomUrl(n.target ?? "") : n.target || (n.linkType === "PAGE" ? "/" : null),
          openInNewTab: !!n.openInNewTab, sortOrder: order++,
        },
        select: { id: true },
      });
      for (const c of n.children ?? []) {
        await tx.storeMenuItem.create({
          data: {
            storeId: a.store.id, location: "header", label: c.label.trim(), linkType: c.linkType,
            target: c.linkType === "CUSTOM" ? sanitizeCustomUrl(c.target ?? "") : c.target || (c.linkType === "PAGE" ? "/" : null),
            openInNewTab: !!c.openInNewTab, parentId: parent.id, sortOrder: order++,
          },
        });
      }
    }
  });

  revalidatePath(`/store/${slug}`, "layout");
  return { success: true, data: undefined };
}

export async function resetStoreMenu(slug: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return { success: false, error: a.error };
  await prisma.storeMenuItem.deleteMany({ where: { storeId: a.store.id, location: "header" } });
  revalidatePath(`/store/${slug}`, "layout");
  return { success: true, data: undefined };
}
