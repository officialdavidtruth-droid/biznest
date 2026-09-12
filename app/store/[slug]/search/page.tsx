import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CatalogGrid } from "@/components/storefront/catalog-grid";
import { resolveStoreTheme } from "@/lib/template-themes";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `"${q}" — Search results` : "Search" };
}

export default async function SearchPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> }) {
  const { slug } = await params;
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();

  const [products, services] = await Promise.all([
    query ? prisma.product.findMany({ where: { storeId: store.id, isPublished: true, OR: [{ name: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] }, include: { category: true } }) : [],
    query ? prisma.service.findMany({ where: { storeId: store.id, isPublished: true, OR: [{ name: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] }, include: { category: true } }) : [],
  ]);

  const items = [
    ...products.map((p) => ({ id: p.id, kind: "product" as const, name: p.name, price: Number(p.price), currency: p.currency, image: p.images[0] ?? null, categoryName: p.category?.name })),
    ...services.map((s) => ({ id: s.id, kind: "service" as const, name: s.name, price: Number(s.price), currency: s.currency, image: s.images[0] ?? null, categoryName: s.category?.name })),
  ];
  const theme = resolveStoreTheme(store.template?.category, store.name, store.themeColors as any, store.fontFamily, store.template?.name);

  return (
    <main style={{ minHeight: "100vh", background: theme.bg, color: theme.ink, fontFamily: theme.font, padding: "6rem 2rem" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <p style={{ color: theme.accent, fontWeight: 700, textTransform: "uppercase" }}>Search</p>
        <h1 style={{ fontFamily: theme.headlineFont }}>{query ? `Results for “${query}”` : "Find what you're looking for"}</h1>
        <form style={{ display: "flex", gap: 8, margin: "24px 0" }}>
          <input name="q" defaultValue={query} placeholder="Search menu or services" style={{ flex: 1, padding: "12px 14px", border: `1px solid ${theme.ink}22`, borderRadius: theme.radius }} />
          <button style={{ background: theme.accent, color: "white", border: 0, borderRadius: theme.radius, padding: "0 20px" }}>Search</button>
        </form>
        <CatalogGrid items={items} slug={slug} accent={theme.accent} ink={theme.ink} radius={theme.radius} />
      </div>
    </main>
  );
}
