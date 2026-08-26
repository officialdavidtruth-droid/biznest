// Route: /store/[slug]/admin/suppliers/[supplierId]
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupplier } from "@/lib/actions/supplier";
import { listProducts } from "@/lib/actions/product";
import { SupplierForm } from "@/components/dashboard/supplier-form";
import { SupplierProductLinks } from "@/components/dashboard/supplier-product-links";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ slug: string; supplierId: string }>;
}) {
  const { slug, supplierId } = await params;
  const [supplier, products] = await Promise.all([getSupplier(slug, supplierId), listProducts(slug)]);
  if (!supplier) notFound();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-6 text-xl font-semibold">{supplier.name}</h1>
        <SupplierForm
          storeSlug={slug}
          supplierId={supplier.id}
          initial={{
            name: supplier.name,
            contactName: supplier.contactName ?? "",
            email: supplier.email ?? "",
            phone: supplier.phone ?? "",
            notes: supplier.notes ?? "",
          }}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Linked products</h2>
        <SupplierProductLinks
          storeSlug={slug}
          supplierId={supplier.id}
          products={products.map((p) => ({ id: p.id, name: p.name }))}
          links={supplier.products.map((l) => ({
            productId: l.productId,
            productName: l.product.name,
            supplierSku: l.supplierSku,
            costPrice: l.costPrice != null ? Number(l.costPrice) : null,
          }))}
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Purchase orders</h2>
          <Link
            href={`/${slug}/admin/purchase-orders/new?supplierId=${supplier.id}`}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            New purchase order
          </Link>
        </div>
        <div className="overflow-hidden rounded-lg border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">PO #</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Subtotal</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {supplier.purchaseOrders.map((po) => (
                <tr key={po.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{po.poNumber}</td>
                  <td className="px-4 py-3">{po.status.replace("_", " ")}</td>
                  <td className="px-4 py-3">{po.currency} {Number(po.subtotal).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/${slug}/admin/purchase-orders/${po.id}`} className="text-xs font-medium text-primary hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {supplier.purchaseOrders.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No purchase orders yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
