import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { resolveStoreTheme, FRESH, isHeenzyTemplate, isNovaTemplate, HEENZY, NOVA, type TemplateTheme } from "@/lib/template-themes";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNav } from "@/components/storefront/category-nav";
import { getStoreCategoryTree } from "@/lib/storefront-categories";
import { CatalogGrid } from "@/components/storefront/catalog-grid";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; categoryId: string }> }): Promise<Metadata> {
  const { categoryId } = await params;
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  return { title: category ? category.name : "Category" };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string; categoryId: string }> }) {
  const { slug, categoryId } = await params;

  const store = await prisma.store.findUnique({
    where: { slug },
    include: { template: true, business: true },
  });
  if (!store || store.status !== "ACTIVE") notFound();

  const category = await prisma.category.findUnique({ where: { id: categoryId }, include: { parent: true, children: true } });
  if (!category) notFound();

  // If this is a parent category (e.g. "Fashion"), show items from it AND
  // every subcategory beneath it (Men's Clothing, Women's Shoes, Jewelry...).
  // If it's a subcategory itself, just show its own items.
  const categoryIds = category.children.length > 0 ? [category.id, ...category.children.map((c) => c.id)] : [category.id];

  const [products, services] = await Promise.all([
    prisma.product.findMany({ where: { storeId: store.id, categoryId: { in: categoryIds }, isPublished: true }, include: { category: true } }),
    prisma.service.findMany({ where: { storeId: store.id, categoryId: { in: categoryIds }, isPublished: true }, include: { category: true } }),
  ]);

  const items = [
    ...products.map((p) => ({ id: p.id, kind: "product" as const, name: p.name, price: Number(p.price), currency: p.currency, image: p.images[0] ?? null, categoryId: p.categoryId, categoryName: p.category?.name })),
    ...services.map((s) => ({ id: s.id, kind: "service" as const, name: s.name, price: Number(s.price), currency: s.currency, image: s.images[0] ?? null, categoryId: s.categoryId, categoryName: s.category?.name })),
  ];
  // An empty category is a real state (e.g. a subcategory with nothing
  // published in it yet) — show a friendly message rather than a 404.

  const categories = await getStoreCategoryTree(store.id);

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  const theme: TemplateTheme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const heenzy = isHeenzyTemplate(store.template?.name);
  const nova = isNovaTemplate(store.template?.name);
  const accent = heenzy ? HEENZY.black : nova ? NOVA.gold : FRESH.leaf;
  const ink = heenzy ? HEENZY.black : nova ? NOVA.cream : FRESH.ink;
  const bg = heenzy ? HEENZY.white : nova ? NOVA.black : FRESH.ivory;
  const radius = heenzy ? "10px" : nova ? "0px" : "0.9rem";

  return (
    <div style={{ fontFamily: theme.font, color: ink, background: bg, minHeight: "100vh" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: `${bg}f2`, backdropFilter: "blur(10px)", borderBottom: `1px solid ${ink}14` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href={`/store/${slug}`} style={{ fontWeight: 800, fontSize: 18, color: ink, textDecoration: "none" }}>{store.name}</Link>
          <CartLink storeSlug={slug} accent={accent} ink={ink} />
        </div>
      </nav>

      <CategoryNav slug={slug} categories={categories} accent={accent} ink={ink} bg={bg} border={`${ink}14`} />

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 28px 80px" }}>
        <div style={{ fontSize: 12.5, marginBottom: 22, opacity: 0.65 }}>
          <Link href={`/store/${slug}`} style={{ color: ink, textDecoration: "none" }}>Home</Link>
          {" / "}
          {category.parent ? (
            <>
              <Link href={`/store/${slug}/category/${category.parent.id}`} style={{ color: ink, textDecoration: "none" }}>{category.parent.name}</Link>
              {" / "}
            </>
          ) : (
            <>
              <Link href={`/store/${slug}/catalog`} style={{ color: ink, textDecoration: "none" }}>All</Link>
              {" / "}
            </>
          )}
          <span>{category.name}</span>
        </div>

        <h1 style={{ fontSize: "clamp(24px,3.4vw,34px)", fontWeight: 800, marginBottom: 8 }}>{category.name}</h1>
        <p style={{ fontSize: 13.5, opacity: 0.65, marginBottom: category.children.length > 0 ? 18 : 32 }}>{items.length} {items.length === 1 ? "item" : "items"}</p>

        {/* Subcategory filter chips, e.g. under "Fashion": Men's Clothing, Women's Shoes, Jewelry... */}
        {category.children.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 30 }}>
            {category.children.map((child) => (
              <Link
                key={child.id}
                href={`/store/${slug}/category/${child.id}`}
                style={{ padding: "7px 14px", borderRadius: 100, fontSize: 12.5, fontWeight: 600, border: `1px solid ${ink}1f`, color: ink, textDecoration: "none" }}
              >
                {child.name}
              </Link>
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <div style={{ border: `1px dashed ${ink}22`, borderRadius: 16, padding: 60, textAlign: "center", opacity: 0.7 }}>
            <p style={{ fontSize: 14 }}>Nothing published in {category.name} yet — check back soon.</p>
          </div>
        ) : (
          <CatalogGrid items={items} slug={slug} accent={accent} ink={ink} radius={radius} />
        )}
      </div>
    </div>
  );
}
