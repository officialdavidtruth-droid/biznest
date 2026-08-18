import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listProducts } from "@/lib/actions/product";
import { ProductsTable } from "@/components/dashboard/products-table";
import { BulkCsvPanel } from "@/components/dashboard/bulk-csv-panel";

export default async function ProductsListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [products, categories] = await Promise.all([
    listProducts(slug),
    prisma.category.findMany({ where: { type: "PRODUCT" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Products</h1>
        <Link
          href={`/${slug}/admin/products/new`}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Add product
        </Link>
      </div>

      <div className="mb-6">
        <BulkCsvPanel storeSlug={slug} />
      </div>

      <ProductsTable
        storeSlug={slug}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          images: p.images,
          price: Number(p.price),
          currency: p.currency,
          isPublished: p.isPublished,
          category: p.category ? { id: p.category.id, name: p.category.name } : null,
          inventory: p.inventory ? { quantity: p.inventory.quantity } : null,
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
