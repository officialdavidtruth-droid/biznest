import { prisma } from "@/lib/prisma";
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

  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return null;

  const [suppliers, products] = await Promise.all([
    listSuppliers(slug),
    prisma.product.findMany({
      where: { storeId: store.id },
      include: { inventory: true, variants: { where: { isActive: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const options: PoLineOption[] = [];
  for (const p of products) {
    if (p.hasVariants) {
      for (const v of p.variants) {
        options.push({
          key: `variant:${v.id}`,
          variantId: v.id,
          label: `${p.name} — ${v.label}`,
          defaultCost: v.costPrice != null ? Number(v.costPrice) : null,
        });
      }
    } else {
      options.push({
        key: `product:${p.id}`,
        productId: p.id,
        label: p.name,
        defaultCost: p.inventory?.costPrice != null ? Number(p.inventory.costPrice) : null,
      });
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">New purchase order</h1>
      <PurchaseOrderForm
        storeSlug={slug}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        options={options}
        defaultSupplierId={supplierId}
      />
    </div>
  );
}
