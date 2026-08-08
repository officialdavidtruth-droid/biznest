import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { resolveStoreTheme, FRESH, isHeenzyTemplate, isNovaTemplate, HEENZY, NOVA, type TemplateTheme } from "@/lib/template-themes";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNav } from "@/components/storefront/category-nav";

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

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) notFound();

  const [products, services, allProducts, allServices] = await Promise.all([
    prisma.product.findMany({ where: { storeId: store.id, categoryId, isPublished: true }, include: { category: true } }),
    prisma.service.findMany({ where: { storeId: store.id, categoryId, isPublished: true }, include: { category: true } }),
    prisma.product.findMany({ where: { storeId: store.id, isPublished: true }, include: { category: true } }),
    prisma.service.findMany({ where: { storeId: store.id, isPublished: true }, include: { category: true } }),
  ]);

  const items = [
    ...products.map((p) => ({ id: p.id, kind: "product" as const, name: p.name, price: Number(p.price), currency: p.currency, image: p.images[0] ?? null })),
    ...services.map((s) => ({ id: s.id, kind: "service" as const, name: s.name, price: Number(s.price), currency: s.currency, image: s.images[0] ?? null })),
  ];
  if (items.length === 0) notFound();

  const categoryCounts = new Map<string, { id: string; name: string; count: number }>();
  for (const p of [...allProducts, ...allServices]) {
    if (!p.category) continue;
    const c = categoryCounts.get(p.category.id) ?? { id: p.category.id, name: p.category.name, count: 0 };
    c.count += 1;
    categoryCounts.set(p.category.id, c);
  }
  const categories = Array.from(categoryCounts.values()).sort((a, b) => b.count - a.count);

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

      <CategoryNav slug={slug} categories={categories} accent={accent} ink={ink} border={`${ink}14`} />

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 28px 80px" }}>
        <div style={{ fontSize: 12.5, marginBottom: 22, opacity: 0.65 }}>
          <Link href={`/store/${slug}`} style={{ color: ink, textDecoration: "none" }}>Home</Link>
          {" / "}
          <Link href={`/store/${slug}/catalog`} style={{ color: ink, textDecoration: "none" }}>All</Link>
          {" / "}
          <span>{category.name}</span>
        </div>

        <h1 style={{ fontSize: "clamp(24px,3.4vw,34px)", fontWeight: 800, marginBottom: 8 }}>{category.name}</h1>
        <p style={{ fontSize: 13.5, opacity: 0.65, marginBottom: 32 }}>{items.length} {items.length === 1 ? "item" : "items"}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
          {items.map((item) => (
            <a
              key={`${item.kind}-${item.id}`}
              href={`/store/${slug}/${item.kind}/${item.id}`}
              style={{ display: "block", textDecoration: "none", color: "inherit", border: `1px solid ${ink}14`, borderRadius: radius, overflow: "hidden", background: `${ink}05` }}
            >
              <div style={{ aspectRatio: "1/1", background: item.image ? `url(${item.image}) center/cover` : `${ink}0d` }} />
              <div style={{ padding: 14 }}>
                <h4 style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 6 }}>{item.name}</h4>
                <span style={{ fontSize: 15, fontWeight: 800, color: accent }}>{item.currency} {item.price.toLocaleString()}</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
