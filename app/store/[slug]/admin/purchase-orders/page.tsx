import Link from "next/link";
import { listPurchaseOrders } from "@/lib/actions/purchase-order";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-100 text-blue-700",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-700",
  RECEIVED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default async function PurchaseOrdersListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const orders = await listPurchaseOrders(slug);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Purchase orders</h1>
        <Link
          href={`/${slug}/admin/purchase-orders/new`}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          New purchase order
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">PO #</th>
              <th className="px-4 py-2">Supplier</th>
              <th className="px-4 py-2">Items</th>
              <th className="px-4 py-2">Subtotal</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((po) => (
              <tr key={po.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{po.poNumber}</td>
                <td className="px-4 py-3">{po.supplier.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{po.items.length}</td>
                <td className="px-4 py-3">{po.currency} {Number(po.subtotal).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[po.status] ?? ""}`}>
                    {po.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/${slug}/admin/purchase-orders/${po.id}`} className="text-xs font-medium text-primary hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No purchase orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
