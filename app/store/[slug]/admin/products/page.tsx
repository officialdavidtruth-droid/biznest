// Route: /store/[slug]/admin/products
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listProductsPage, getProductStats, type ProductListQuery } from "@/lib/actions/product";
import { ProductsTable } from "@/components/dashboard/products-table";
import { BulkCsvPanel } from "@/components/dashboard/bulk-csv-panel";
import { getBusinessTerminology } from "@/lib/business-terminology";
import { Package, Layers3, CheckCircle2, CircleAlert, Plus, Upload, ExternalLink, ChevronRight, Boxes } from "lucide-react";

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ProductsListPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const pick = <T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined => (v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);
  const query: ProductListQuery = {
    q: one(sp.q)?.slice(0, 120),
    categoryId: one(sp.category) || undefined,
    status: pick(one(sp.status), ["published", "draft", "archived"] as const),
    availability: pick(one(sp.avail), ["available", "low", "out"] as const),
    page: Number(one(sp.page)) || 1,
    size: Number(one(sp.size)) || 20,
  };
  const [list, stats, store] = await Promise.all([
    listProductsPage(slug, query),
    getProductStats(slug),
    prisma.store.findUnique({ where: { slug }, select: { id: true, name: true, business: { select: { category: true } } } }),
  ]);
  const products = list.rows;
  const terminology = getBusinessTerminology(store?.business.category);
  const categories = store ? await prisma.category.findMany({ where: { storeId: store.id, type: "PRODUCT" }, orderBy: { name: "asc" } }) : [];
  // Counts come from the database, not from the (capped) list below.
  const totalCount = stats?.total ?? list.total;
  const activeCount = stats?.published ?? 0;
  const outOfStock = stats?.outOfStock ?? 0;
  const categoryCounts = categories.map((c) => ({ ...c, count: stats?.byCategory[c.id] ?? 0 }));
  const genericCategory = terminology.category;

  const outlineBtn = "inline-flex items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:-translate-y-px hover:bg-muted/60 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--bn-admin-orange)_45%,transparent)]";
  const categoriesLabel = plural(genericCategory);
  const filtering = Boolean(query.q || query.categoryId || query.status || query.availability);

  return (
    <div className="bn-admin-page space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--bn-admin-orange)] text-white shadow-md shadow-[color-mix(in_srgb,var(--bn-admin-orange)_30%,transparent)]">
            <Package className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{terminology.catalogPageTitle}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Manage your {terminology.catalog.toLowerCase()}, {categoriesLabel.toLowerCase()} and pricing</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/store/${slug}`} target="_blank" className={outlineBtn}><ExternalLink className="h-4 w-4" />View store</Link>
          <Link href={`/store/${slug}/admin/products?import=1#bulk-import`} className={outlineBtn}><Upload className="h-4 w-4" />Import {terminology.catalog.toLowerCase()}</Link>
          <Link href={`/store/${slug}/admin/products/new`} className="inline-flex items-center gap-2 rounded-xl bg-[var(--bn-admin-orange)] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[color-mix(in_srgb,var(--bn-admin-orange)_30%,transparent)] transition hover:-translate-y-px hover:bg-[var(--bn-admin-orange-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--bn-admin-orange)_45%,transparent)]"><Plus className="h-4 w-4" />Add {terminology.catalogSingular.toLowerCase()}</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat href={`/store/${slug}/admin/products`} icon={Package} tone="green" label={`Total ${terminology.catalog.toLowerCase()}`} value={totalCount} note="Across all categories" />
        <Stat href={`/store/${slug}/admin/categories`} icon={Layers3} tone="blue" label={categoriesLabel} value={categories.length} note={`Active ${categoriesLabel.toLowerCase()}`} />
        <Stat href={`/store/${slug}/admin/products?status=published`} icon={CheckCircle2} tone="teal" label={`Active ${terminology.catalog.toLowerCase()}`} value={activeCount} note="Published and visible" />
        <Stat href={`/store/${slug}/admin/products?avail=out`} icon={CircleAlert} tone={outOfStock > 0 ? "red" : "muted"} label="Out of stock" value={outOfStock} note={outOfStock > 0 ? "Tap to see them" : "Nothing is sold out"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="min-w-0">
          <section className="rounded-2xl border bg-background p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{terminology.catalog}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {filtering ? `${list.total} ${list.total === 1 ? "match" : "matches"} for your filters` : `Manage your ${terminology.catalog.toLowerCase()} and their availability`}
                </p>
              </div>
              <div id="bulk-import" className="scroll-mt-24"><BulkCsvPanel storeSlug={slug} /></div>
            </div>
            <ProductsTable
              storeSlug={slug}
              products={products.map((p) => ({
                id: p.id, name: p.name, images: p.images, price: Number(p.price), currency: p.currency,
                isPublished: p.isPublished,
                archived: p.archivedAt != null,
                category: p.category ? { id: p.category.id, name: p.category.name } : null,
                // Only physical products track stock (same rule as the stats cards and the
                // storefront); digital and rental items would otherwise show "Out of Stock".
                inventory: p.type !== "PHYSICAL"
                  ? null
                  : p.hasVariants
                  ? { quantity: p.variants.reduce((sum, variant) => sum + (variant.isActive ? variant.quantity : 0), 0) }
                  : p.inventory ? { quantity: p.inventory.quantity, lowStockThreshold: p.inventory.lowStockThreshold } : null,
                orders: p._count.orderItems,
              }))}
              categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              terminology={terminology}
              query={{ q: query.q ?? "", categoryId: query.categoryId ?? "", status: query.status ?? "", availability: query.availability ?? "" }}
              pagination={{ page: list.page, size: list.size, total: list.total, totalPages: list.totalPages }}
              addHref={`/store/${slug}/admin/products/new`}
            />
          </section>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-4">
          <section className="rounded-2xl border bg-background p-5 shadow-sm">
            <div className="mb-3">
              <h2 className="text-lg font-bold">{terminology.catalog} {categoriesLabel.toLowerCase()}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Tap one to filter the list</p>
            </div>
            <nav className="space-y-0.5" aria-label={`${terminology.catalog} ${categoriesLabel.toLowerCase()}`}>
              <CategoryRow href={`/store/${slug}/admin/products`} name={`All ${terminology.catalog.toLowerCase()}`} count={totalCount} active={!query.categoryId} />
              {categoryCounts.slice(0, 8).map((c) => (
                <CategoryRow key={c.id} href={`/store/${slug}/admin/products?category=${c.id}`} name={c.name} count={c.count} active={query.categoryId === c.id} />
              ))}
            </nav>
            {categoryCounts.length > 8 && (
              <Link href={`/store/${slug}/admin/categories`} className="mt-1 block px-3 py-2 text-xs font-semibold text-[var(--bn-admin-orange)] hover:underline">See all {categoryCounts.length} {categoriesLabel.toLowerCase()}</Link>
            )}
            <Link href={`/store/${slug}/admin/categories`} className={`${outlineBtn} mt-4 w-full justify-center`}><Plus className="h-4 w-4" />Add {genericCategory.toLowerCase()}</Link>
          </section>
          <section className="rounded-2xl border bg-background p-5 shadow-sm">
            <h2 className="text-lg font-bold">Quick actions</h2>
            <div className="mt-3 space-y-1">
              <Quick href={`/store/${slug}/admin/products/new`} icon={Plus} title={`Add new ${terminology.catalogSingular.toLowerCase()}`} note={`Create a new ${terminology.catalogSingular.toLowerCase()}`} />
              <Quick href={`/store/${slug}/admin/products?import=1#bulk-import`} icon={Upload} title={`Bulk upload ${terminology.catalog.toLowerCase()}`} note="Import many items from a CSV file" />
              <Quick href={`/store/${slug}/admin/categories`} icon={Layers3} title={`Manage ${categoriesLabel.toLowerCase()}`} note={`Organize your ${terminology.catalog.toLowerCase()}`} />
              <Quick href={`/store/${slug}/admin/inventory`} icon={Boxes} title="Manage inventory" note="Stock levels and availability" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** "Category" -> "Categories", "Collection" -> "Collections". */
function plural(word: string): string {
  return /[^aeiou]y$/i.test(word) ? `${word.slice(0, -1)}ies` : /(s|x|ch|sh)$/i.test(word) ? `${word}es` : `${word}s`;
}

const TONES: Record<string, string> = {
  green: "bg-[var(--bn-admin-orange-soft)] text-[var(--bn-admin-orange)]",
  blue: "bg-sky-50 text-sky-700",
  teal: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-600",
  muted: "bg-muted text-muted-foreground",
};

function Stat({ href, icon: Icon, tone, label, value, note }: { href: string; icon: typeof Package; tone: string; label: string; value: number; note: string }) {
  return (
    <Link href={href} className="group flex items-center gap-4 rounded-2xl border bg-background p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--bn-admin-orange)_40%,transparent)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--bn-admin-orange)_45%,transparent)] sm:p-5">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${TONES[tone] ?? TONES.muted}`}><Icon className="h-6 w-6" /></span>
      <span className="min-w-0">
        <span className="block truncate text-sm text-muted-foreground">{label}</span>
        <span className="block text-3xl font-extrabold leading-tight tabular-nums">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{note}</span>
      </span>
    </Link>
  );
}
function CategoryRow({ href, name, count, active }: { href: string; name: string; count: number; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? "bg-[var(--bn-admin-orange-soft)] font-semibold text-[var(--bn-admin-orange)]" : "hover:bg-muted/60"}`}>
      <span className="truncate">{name}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${active ? "bg-background text-[var(--bn-admin-orange)]" : "bg-muted text-muted-foreground"}`}>{count}</span>
    </Link>
  );
}
function Quick({ href, icon: Icon, title, note }: { href: string; icon: typeof Plus; title: string; note: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/60">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--bn-admin-orange-soft)] text-[var(--bn-admin-orange)]"><Icon className="h-[18px] w-[18px]" /></span>
      <span className="min-w-0 flex-1"><b className="block text-sm">{title}</b><small className="text-xs text-muted-foreground">{note}</small></span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
