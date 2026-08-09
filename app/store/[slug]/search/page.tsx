import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { resolveStoreTheme, type TemplateTheme } from "@/lib/template-themes";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNav } from "@/components/storefront/category-nav";
import { getStoreCategoryTree } from "@/lib/storefront-categories";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `"${q}" — Search results` : "Search" };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const store = await prisma.store.findUnique({ where: { slug }, include: { template: true, business: true } });
  if (!store || store.status !== "ACTIVE") notFound();

  const [products, services, categories] = await Promise.all([
    query
      ? prisma.product.findMany({
          where: { storeId: store.id, isPublished: true, OR: [{ name: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] },
          include: { category: true },
        })
      : Promise.resolve([]),
    query
      ? prisma.service.findMany({
          where: { storeId: store.id, isPublished: true, OR: [{ name: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] },
          include: { category: true },
        })
      : Promise.resolve([]),
    getStoreCategoryTree(store.id),
  ]);

  const items = [
    ...products.map((p) => ({ id: p.id, kind: "product" as const, name: p.name, price: Number(p.price), currency: p.currency, image: p.images[0] ?? null, categoryName: p.category?.name })),
    ...services.map((s) => ({ id: s.id, kind: "service" as const, name: s.name, price: Number(s.price), currency: s.currency, image: s.images[0] ?? null, categoryName: s.category?.name })),
  ];

  const themeOverrides = store.themeColors as { primary?: string; secondary?: string; accent?: string } | null;
  // This template's own real palette/radius, not a Heenzy/Nova-only fallback.
  const theme: TemplateTheme = resolveStoreTheme(store.template?.category, store.name, themeOverrides, store.fontFamily, store.template?.name);
  const { accent, ink, bg, radius } = theme;

  return (
    <div style={{ fontFamily: theme.font, color: ink, background: bg, minHeight: "100vh" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: `${bg}f2`, backdropFilter: "blur(10px)", borderBottom: `1px solid ${ink}14` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <Link href={`/store/${slug}`} style={{ fontWeight: 800, fontSize: 18, color: ink, textDecoration: "none", flexShrink: 0 }}>{store.name}</Link>
          <form action={`/store/${slug}/search`} style={{ flex: 1, maxWidth: 420 }}>
            <input
              name="q"
              defaultValue={query}
              placeholder="Search this store…"
              style={{ width: "100%", padding: "9px 14px", borderRadius: 100, border: `1px solid ${ink}22`, background: `${ink}05`, color: ink, fontSize: 13.5, outline: "none" }}
            />
          </form>
          <CartLink storeSlug={slug} accent={accent} ink={ink} />
        </div>
      </nav>

      <CategoryNav slug={slug} categories={categories} accent={accent} ink={ink} bg={bg} border={`${ink}14`} />

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 28px 80px" }}>
        <h1 style={{ fontSize: "clamp(22px,3vw,30px)", fontWeight: 800, marginBottom: 8 }}>
          {query ? <>Results for &ldquo;{query}&rdquo;</> : "Search"}
        </h1>
        <p style={{ fontSize: 13.5, opacity: 0.65, marginBottom: 32 }}>
          {query ? `${items.length} ${items.length === 1 ? "result" : "results"}` : "Type something in the search box above."}
        </p>

        {query && items.length === 0 && (
          <div style={{ border: `1px dashed ${ink}22`, borderRadius: 16, padding: 48, textAlign: "center", opacity: 0.7 }}>
            <p style={{ fontSize: 14 }}>No results for &ldquo;{query}&rdquo;.</p>
            <Link href={`/store/${slug}/catalog`} style={{ color: accent, fontSize: 13, fontWeight: 700, textDecoration: "underline" }}>Browse everything instead →</Link>
          </div>
        )}

        {items.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
            {items.map((item) => (
              <a
                key={`${item.kind}-${item.id}`}
                href={`/store/${slug}/${item.kind}/${item.id}`}
                style={{ display: "block", textDecoration: "none", color: "inherit", border: `1px solid ${ink}14`, borderRadius: radius, overflow: "hidden", background: `${ink}05` }}
              >
                <div style={{ aspectRatio: "1/1", background: item.image ? `url(${item.image}) center/cover` : `${ink}0d` }} />
                <div style={{ padding: 14 }}>
                  {item.categoryName && <div style={{ fontSize: 10.5, opacity: 0.55, textTransform: "uppercase", marginBottom: 4 }}>{item.categoryName}</div>}
                  <h4 style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 6 }}>{item.name}</h4>
                  <span style={{ fontSize: 15, fontWeight: 800, color: accent }}>{item.currency} {item.price.toLocaleString()}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
