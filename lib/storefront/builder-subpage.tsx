import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { resolveHomeRenderer } from "@/lib/storefront/resolve-renderer";
import { resolveStoreTheme } from "@/lib/template-themes";
import { catalogDesign, catalogStoreInfo } from "@/lib/storefront/catalog-props";
import { BuilderSubpage, type SubpageKind } from "@/components/storefront/builder-subpages";

/**
 * About / Contact / Categories for stores whose homepage is drawn by the shared Builder.
 * Returns null for every other template family (Example, TasteHouse, hotel, legacy,
 * signature, ...) so callers keep their own handling for those.
 */
export async function renderBuilderSubpage(slug: string, kind: SubpageKind) {
  const raw = await prisma.store.findUnique({
    where: { slug },
    include: {
      template: true,
      business: true,
      reviews: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 12 },
    },
  });
  if (!raw || raw.status !== "ACTIVE") notFound();
  if (resolveHomeRenderer(raw.template?.name).kind !== "builder") return null;

  const theme = resolveStoreTheme(raw.template?.category, raw.name, raw.themeColors as any, raw.fontFamily, raw.template?.name);
  const [cats, products, services, completedOrders] = await Promise.all([
    kind === "categories"
      ? prisma.category.findMany({
          where: { storeId: raw.id, isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, parentId: true, _count: { select: { products: { where: { isPublished: true } }, services: { where: { isPublished: true } } } } },
        })
      : Promise.resolve([] as any[]),
    prisma.product.count({ where: { storeId: raw.id, isPublished: true } }),
    prisma.service.count({ where: { storeId: raw.id, isPublished: true } }),
    kind === "about" ? prisma.order.count({ where: { storeId: raw.id, status: "COMPLETED" } }).catch(() => 0) : Promise.resolve(0),
  ]);

  const count = (c: any) => c._count.products + c._count.services;
  const categories = cats
    .filter((c: any) => !c.parentId)
    .map((c: any) => {
      const kids = cats.filter((k: any) => k.parentId === c.id).map((k: any) => ({ id: k.id, name: k.name, count: count(k) }));
      return { id: c.id, name: c.name, count: count(c) + kids.reduce((n: number, k: { count: number }) => n + k.count, 0), children: kids };
    });

  const reviews = (raw.reviews ?? [])
    .filter((r: any) => r.rating >= 4 && r.comment)
    .slice(0, 3)
    .map((r: any) => ({ id: r.id, rating: r.rating, comment: String(r.comment), author: r.author?.name || "Customer" }));

  return (
    <BuilderSubpage
      kind={kind}
      store={catalogStoreInfo(raw, slug)}
      design={catalogDesign(raw, theme)}
      data={{
        storyImage: raw.storyImage ?? raw.bannerUrl ?? null,
        location: [raw.business?.city, raw.business?.state, raw.business?.country].filter(Boolean).join(", "),
        itemCount: products + services,
        completedOrders,
        avgRating: raw.business?.avgRating ?? null,
        reviews,
        categories,
      }}
    />
  );
}
