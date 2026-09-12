// Route: /store/[slug]/admin/purchase-orders/[poId]
import { notFound } from "next/navigation";
import { getPurchaseOrder } from "@/lib/actions/purchase-order";
import { PurchaseOrderActions } from "@/components/dashboard/purchase-order-actions";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-100 text-blue-700",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-700",
  RECEIVED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ slug: string; poId: string }>;
}) {
  const { slug, poId } = await params;
  const po = await getPurchaseOrder(slug, poId);
  if (!po) notFound();

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-1 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{po.poNumber}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[po.status] ?? ""}`}>
            {po.status.replace("_", " ")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Supplier: {po.supplier.name}</p>
        {po.expectedAt && <p className="text-sm text-muted-foreground">Expected: {po.expectedAt.toLocaleDateString()}</p>}
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Ordered</th>
              <th className="px-4 py-2">Received</th>
              <th className="px-4 py-2">Unit cost</th>
              <th className="px-4 py-2">Line total</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{item.description}</td>
                <td className="px-4 py-3">{item.quantityOrdered}</td>
                <td className="px-4 py-3">{item.quantityReceived}</td>
                <td className="px-4 py-3">{Number(item.unitCost).toLocaleString()}</td>
                <td className="px-4 py-3">{(item.quantityOrdered * Number(item.unitCost)).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t px-4 py-3 text-right text-sm font-medium">
          Subtotal: {po.currency} {Number(po.subtotal).toLocaleString()}
        </div>
      </div>

      {po.notes && <p className="text-sm text-muted-foreground">Notes: {po.notes}</p>}

      <PurchaseOrderActions
        storeSlug={slug}
        poId={po.id}
        status={po.status}
        items={po.items.map((i) => ({
          id: i.id,
          description: i.description,
          quantityOrdered: i.quantityOrdered,
          quantityReceived: i.quantityReceived,
          unitCost: Number(i.unitCost),
        }))}
      />
    </div>
  );
}
