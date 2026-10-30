// Route: /store/[slug]/admin/purchase-orders/[poId]
import { notFound } from "next/navigation";
import { getPurchaseOrder } from "@/lib/actions/purchase-order";
import { PurchaseOrderActions } from "@/components/dashboard/purchase-order-actions";
import { formatDate, formatNumber } from "@/lib/i18n/locale";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)]",
  PARTIALLY_RECEIVED: "bg-[var(--bn-admin-orange-soft)] text-[var(--bn-admin-orange)]",
  RECEIVED: "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)]",
  CANCELLED: "bg-[var(--bn-admin-danger-soft)] text-[var(--bn-admin-danger)]",
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
        {po.expectedAt && <p className="text-sm text-muted-foreground">Expected: {formatDate(po.expectedAt)}</p>}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="min-w-[640px] w-full text-sm">
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
                <td className="px-4 py-3">{formatNumber(Number(item.unitCost))}</td>
                <td className="px-4 py-3">{formatNumber((item.quantityOrdered * Number(item.unitCost)))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t px-4 py-3 text-right text-sm font-medium">
          Subtotal: {po.currency} {formatNumber(Number(po.subtotal))}
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
