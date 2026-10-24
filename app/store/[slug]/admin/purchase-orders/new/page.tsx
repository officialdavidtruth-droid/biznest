// Route: /store/[slug]/admin/purchase-orders/new
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { listSuppliers } from "@/lib/actions/supplier";
import { PurchaseOrderForm, type PoLineOption } from "@/components/dashboard/purchase-order-form";

export default async function NewPurchaseOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ supplierId?: string }>;
}) {
  const { slug } = await params;
  const { supplierId } = await searchParams;

  const access = await assertStorePermission(slug, "products");
  if (!access.success) redirect(`/store/${slug}/admin`);

  const [suppliers, products] = await Promise.all([
    listSuppliers(slug),
    prisma.product.findMany({
      where: { storeId: access.store.id },
      select: {
        id: true,
        name: true,
        costPrice: true,
        hasVariants: true,
        variants: {
          where: { isActive: true },
          select: { id: true, label: true, costPrice: true },
          orderBy: { label: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // One selectable line per orderable thing: a product with active variants is
  // ordered by variant; any other product is ordered directly.
  const options: PoLineOption[] = [];
  for (const p of products) {
    if (p.hasVariants && p.variants.length > 0) {
      for (const v of p.variants) {
        const cost = v.costPrice ?? p.costPrice;
        options.push({
          key: `variant:${v.id}`,
          productId: p.id,
          variantId: v.id,
          label: `${p.name} — ${v.label}`,
          defaultCost: cost != null ? Number(cost) : null,
        });
      }
    } else {
      options.push({
        key: `product:${p.id}`,
        productId: p.id,
        label: p.name,
        defaultCost: p.costPrice != null ? Number(p.costPrice) : null,
      });
    }
  }

  const defaultSupplierId = suppliers.some((s) => s.id === supplierId) ? supplierId : undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/store/${slug}/admin/purchase-orders`} className="text-xs font-medium text-primary hover:underline">
          ← Purchase orders
        </Link>
        <h1 className="mt-2 text-xl font-semibold">New purchase order</h1>
      </div>

      {suppliers.length === 0 ? (
        <div className="max-w-xl rounded-lg border p-6 text-sm">
          <p className="font-medium">Add a supplier first</p>
          <p className="mt-1 text-muted-foreground">A purchase order is placed with a supplier, and you don't have any yet.</p>
          <Link
            href={`/store/${slug}/admin/suppliers/new`}
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Add supplier
          </Link>
        </div>
      ) : options.length === 0 ? (
        <div className="max-w-xl rounded-lg border p-6 text-sm">
          <p className="font-medium">No products to order yet</p>
          <p className="mt-1 text-muted-foreground">Add a product to your catalog, then come back to create the order.</p>
          <Link
            href={`/store/${slug}/admin/products`}
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Go to products
          </Link>
        </div>
      ) : (
        <PurchaseOrderForm
          storeSlug={slug}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          options={options}
          defaultSupplierId={defaultSupplierId}
        />
      )}
    </div>
  );
}
