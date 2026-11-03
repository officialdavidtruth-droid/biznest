"use server";

import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import { buildStoreUrl } from "@/lib/store-url";

export type QrTarget = {
  /** What the QR points at, e.g. "product" | "service" | "category". */
  kind: "product" | "service" | "category";
  id: string;
  name: string;
  /** Full customer-facing URL (custom domain when verified, else biznest.space/<slug>). */
  url: string;
  image?: string | null;
};

export type QrCodesData = {
  storeName: string;
  storeUrl: string;
  catalogUrl: string;
  products: QrTarget[];
  services: QrTarget[];
  categories: QrTarget[];
  truncated: boolean;
};

const LIMIT = 500;

/**
 * Everything the QR Codes workspace needs: the store's public links plus its
 * published products, services and active categories. Only published items
 * are listed, because a QR printed for a hidden item would send customers to
 * a 404. URLs are built with buildStoreUrl so a verified custom domain is
 * used automatically.
 */
export async function getQrCodesData(slug: string): Promise<QrCodesData | { error: string }> {
  const access = await assertStorePermission(slug, "plugin:qr-codes");
  if (!access.success) return { error: access.error };

  const entitlement = await getPluginEntitlement(access.store.id, "qr-codes");
  if (!entitlement.allowed || !entitlement.installed) return { error: entitlement.reason ?? "Install this app first." };

  const storeId = access.store.id;
  const [products, services, categories] = await Promise.all([
    prisma.product.findMany({
      where: { storeId, isPublished: true },
      orderBy: { name: "asc" },
      take: LIMIT + 1,
      select: { id: true, name: true, images: true },
    }),
    prisma.service.findMany({
      where: { storeId, isPublished: true },
      orderBy: { name: "asc" },
      take: LIMIT + 1,
      select: { id: true, name: true, images: true },
    }),
    prisma.category.findMany({
      where: { storeId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: LIMIT + 1,
      select: { id: true, name: true, slug: true, imageUrl: true },
    }),
  ]);

  const truncated = products.length > LIMIT || services.length > LIMIT || categories.length > LIMIT;
  const url = (path: string) => buildStoreUrl(access.store, path);

  return {
    storeName: access.store.name,
    storeUrl: url(""),
    catalogUrl: url("/catalog"),
    truncated,
    products: products.slice(0, LIMIT).map((p) => ({ kind: "product", id: p.id, name: p.name, url: url(`/product/${p.id}`), image: p.images[0] ?? null })),
    services: services.slice(0, LIMIT).map((s) => ({ kind: "service", id: s.id, name: s.name, url: url(`/service/${s.id}`), image: s.images[0] ?? null })),
    categories: categories.slice(0, LIMIT).map((c) => ({ kind: "category", id: c.id, name: c.name, url: url(`/category/${c.slug || c.id}`), image: c.imageUrl })),
  };
}
