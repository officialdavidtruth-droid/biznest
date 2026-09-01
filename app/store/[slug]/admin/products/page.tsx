// Route: /store/[slug]/admin/products
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listProducts } from "@/lib/actions/product";
import { ProductsTable } from "@/components/dashboard/products-table";
import { BulkCsvPanel } from "@/components/dashboard/bulk-csv-panel";
import { getBusinessTerminology } from "@/lib/business-terminology";
import { Package, Layers3, CheckCircle2, CircleAlert, Plus, Upload, SlidersHorizontal } from "lucide-react";

export default async function ProductsListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [products, store] = await Promise.all([
    listProducts(slug),
    prisma.store.findUnique({ where: { slug }, select: { id: true, name: true, business: { select: { category: true } } } }),
  ]);
  const terminology = getBusinessTerminology(store?.business.category);
  const categories = store ? await prisma.category.findMany({ where: { storeId: store.id, type: "PRODUCT" }, orderBy: { name: "asc" } }) : [];
  const activeCount = products.filter((p) => p.isPublished).length;
  const outOfStock = products.filter((p) => (p.inventory?.quantity ?? 0) <= 0).length;

  const categoryCounts = categories.map((c) => ({ ...c, count: products.filter((p) => p.category?.id === c.id).length }));
  const genericCategory = terminology.category;

  return (
    <div className="bn-admin-page space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{terminology.catalog}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your {terminology.catalog.toLowerCase()}, categories and pricing</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${slug}`} target="_blank" className="bn-admin-action rounded-lg border bg-white px-4 py-2.5 text-sm font-semibold">View Store ↗</Link>
          <Link href={`/${slug}/admin/products?import=1`} className="bn-admin-action rounded-lg border bg-white px-4 py-2.5 text-sm font-semibold"><Upload className="mr-2 inline h-4 w-4" />Import {terminology.catalog}</Link>
          <Link href={`/${slug}/admin/products/new`} className="bn-admin-action rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus className="mr-2 inline h-4 w-4" />Add {terminology.catalogSingular}</Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Package} tone="purple" label={`Total ${terminology.catalog}`} value={products.length} note="Across all categories" />
        <Stat icon={Layers3} tone="orange" label={genericCategory + "s"} value={categories.length} note={`Active ${genericCategory.toLowerCase()}s`} />
        <Stat icon={CheckCircle2} tone="green" label={`Active ${terminology.catalog}`} value={activeCount} note="Published and visible" />
        <Stat icon={CircleAlert} tone="red" label="Out of Stock" value={outOfStock} note="Currently unavailable" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0">
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h2 className="text-base font-bold">{terminology.catalog}</h2><p className="mt-1 text-xs text-muted-foreground">Manage your {terminology.catalog.toLowerCase()} and their availability</p></div>
              <button className="rounded-lg border bg-white p-2.5 text-muted-foreground"><SlidersHorizontal className="h-4 w-4" /></button>
            </div>
            <div className="mb-4"><BulkCsvPanel storeSlug={slug} /></div>
            <ProductsTable
              storeSlug={slug}
              products={products.map((p) => ({
                id: p.id, name: p.name, images: p.images, price: Number(p.price), currency: p.currency,
                isPublished: p.isPublished,
                category: p.category ? { id: p.category.id, name: p.category.name } : null,
                inventory: p.inventory ? { quantity: p.inventory.quantity } : null,
                orders: p._count.orderItems,
              }))}
              categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              terminology={terminology}
            />
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-3"><h2 className="text-base font-bold">{terminology.catalog} Categories</h2><p className="mt-1 text-xs text-muted-foreground">Manage your {genericCategory.toLowerCase()}s</p></div>
            <div className="divide-y divide-[#eef0f3]">
              <CategoryRow name={`All ${terminology.catalog}`} count={products.length} />
              {categoryCounts.slice(0, 8).map((c) => <CategoryRow key={c.id} name={c.name} count={c.count} />)}
            </div>
            <Link href={`/${slug}/admin/categories`} className="mt-4 block rounded-lg border px-3 py-2.5 text-center text-xs font-semibold hover:bg-slate-50">＋ Add {genericCategory}</Link>
          </section>
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold">Quick Actions</h2>
            <div className="mt-3 space-y-1">
              <Quick href={`/${slug}/admin/products/new`} icon={Plus} title={`Add New ${terminology.catalogSingular}`} note={`Create a new ${terminology.catalogSingular.toLowerCase()}`} />
              <Quick href={`/${slug}/admin/products?import=1`} icon={Upload} title={`Bulk Upload ${terminology.catalog}`} note="Import multiple items at once" />
              <Quick href={`/${slug}/admin/categories`} icon={Layers3} title={`Manage ${genericCategory}s`} note={`Organize your ${terminology.catalog.toLowerCase()}`} />
              <Quick href={`/${slug}/admin/inventory`} icon={Package} title="Manage Inventory" note="Stock levels and availability" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, tone, label, value, note }: { icon: typeof Package; tone: string; label: string; value: number; note: string }) {
  return <div className="rounded-xl border bg-white p-5 shadow-sm"><div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tone === "purple" ? "bg-violet-50 text-violet-600" : tone === "orange" ? "bg-orange-50 text-orange-500" : tone === "green" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}><Icon className="h-5 w-5" /></div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{note}</p></div>;
}
function CategoryRow({ name, count }: { name: string; count: number }) { return <div className="flex items-center justify-between py-3 text-xs"><span className="font-medium">{name}</span><span className="rounded-md border px-2 py-0.5 text-[10px] text-muted-foreground">{count}</span></div>; }
function Quick({ href, icon: Icon, title, note }: { href: string; icon: typeof Plus; title: string; note: string }) { return <Link href={href} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-slate-50"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fff3df] text-[#b57719]"><Icon className="h-4 w-4" /></span><span className="min-w-0"><b className="block text-xs">{title}</b><small className="text-[10px] text-muted-foreground">{note}</small></span></Link>; }
