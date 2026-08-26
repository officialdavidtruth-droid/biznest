// Route: /store/[slug]/admin/suppliers
import Link from "next/link";
import { listSuppliers } from "@/lib/actions/supplier";

export default async function SuppliersListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const suppliers = await listSuppliers(slug);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Suppliers</h1>
        <Link
          href={`/${slug}/admin/suppliers/new`}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Add supplier
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Supplier</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Products</th>
              <th className="px-4 py-2">Purchase orders</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.contactName || s.email || s.phone || "—"}</td>
                <td className="px-4 py-3">{s._count.products}</td>
                <td className="px-4 py-3">{s._count.purchaseOrders}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/${slug}/admin/suppliers/${s.id}`} className="text-xs font-medium text-primary hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No suppliers yet. Add one to start raising purchase orders.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
