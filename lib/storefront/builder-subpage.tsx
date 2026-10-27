import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { resolveHomeRenderer } from "@/lib/storefront/resolve-renderer";
import { getSavedBuilder } from "@/lib/storefront/saved-builder";
import { getOwnerPage, type OwnerPageSlug } from "@/lib/storefront/owner-pages";
import { resolveStoreTheme } from "@/lib/template-themes";
import { catalogDesign, catalogStoreInfo } from "@/lib/storefront/catalog-props";
import { BuilderSubpage, type SubpageKind } from "@/components/storefront/builder-subpages";

const OWNER_KINDS = new Set<SubpageKind>(["about", "contact", "gallery", "blog"]);

/**
 * About / Contact / Categories / Gallery / Blog on the shared Builder chrome (header, footer, design tokens).
 *
 * Drawn when:
 *  - the store's template is a Builder template, or
 *  - the owner published a visual-builder layout (it replaces the template's homepage, so inner pages follow), or
 *  - the owner wrote and published that page in Customize > Pages (About, Contact, Gallery, Blog), which must
 *    show for every template, not only the Builder ones.
 * Returns null otherwise so callers keep their own handling (Example, TasteHouse, hotel, legacy, ...).
 *
 * `onlyIfCustomised` is for routes that normally check a template-specific page first (hotel, restaurant): it
 * returns null unless the owner has customised something, so default pages are unchanged.
 */
export async function renderBuilderSubpage(slug: string, kind: SubpageKind, opts?: { onlyIfCustomised?: boolean }) {
  const raw = await prisma.store.findUnique({
    where: { slug },
    include: {
      template: true,
      business: true,
      reviews: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 12 },
    },
  });
  if (!raw || raw.status !== "ACTIVE") notFound();
  const native = resolveHomeRenderer(raw.template?.name).kind === "builder";
  const saved = !!getSavedBuilder(raw.sectionOverrides);
  const owner = OWNER_KINDS.has(kind) ? await getOwnerPage(raw.id, kind as OwnerPageSlug) : null;
  // Gallery and Blog have no default page: they exist only when the owner wrote them.
  if ((kind === "gallery" || kind === "blog") && !owner) return null;
  if (opts?.onlyIfCustomised ? !(saved || owner) : !(native || saved || owner)) return null;

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
      owner={owner}
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
