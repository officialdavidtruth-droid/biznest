// Route: /store/[slug]/admin/invoices
import { listInvoices } from "@/lib/actions/invoice";
import { InvoiceForm } from "@/components/dashboard/invoice-form";
import { InvoiceRowActions } from "@/components/dashboard/invoice-row-actions";
import { prisma } from "@/lib/prisma";
import { formatDate, formatNumber } from "@/lib/i18n/locale";
import { getInHouseReservations } from "@/lib/actions/folio";
import { TableScroll } from "@/components/ui/table-scroll";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-[var(--bn-admin-surface)] text-[var(--bn-admin-text)]",
  SENT: "bg-[var(--bn-admin-orange-soft)] text-[var(--bn-admin-orange)]",
  PAID: "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)]",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export default async function InvoicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const invoices = await listInvoices(slug);
  // Any product's currency reflects the store's billing currency (they all
  // share one -- see Product.currency default) -- fall back to NGN for a
  // brand-new store with no products yet.
  const sampleProduct = await prisma.product.findFirst({
    where: { store: { slug } },
    select: { currency: true },
  });
  const currency = sampleProduct?.currency ?? "NGN";

  // Hotels: which bills are already on a guest's room, and who is in-house to charge to.
  const rooms = await getInHouseReservations(slug);
  const onRoom = invoices.length
    ? await prisma.propertyFolioCharge.findMany({
        where: { store: { slug }, sourceType: "INVOICE", sourceId: { in: invoices.map((i) => i.id) }, status: "OPEN" },
        select: { sourceId: true, reservation: { select: { room: { select: { name: true } } } } },
      })
    : [];
  const roomByInvoice = new Map(onRoom.map((c) => [c.sourceId, c.reservation.room.name]));

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Invoices</h1>

      <InvoiceForm storeSlug={slug} currency={currency} />

      <TableScroll className="rounded-lg border bg-background">
        <table className="min-w-[640px] w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Invoice</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{invoice.invoiceNo}</td>
                <td className="px-4 py-3">{invoice.customer?.name ?? invoice.customerName ?? "—"}</td>
                <td className="px-4 py-3">
                  {invoice.currency} {formatNumber(Number(invoice.total))}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[invoice.status]}`}>
                    {invoice.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(new Date(invoice.createdAt))}
                </td>
                <td className="px-4 py-3">
                  <InvoiceRowActions storeSlug={slug} invoiceId={invoice.id} status={invoice.status} rooms={rooms} postedTo={roomByInvoice.get(invoice.id) ?? null} />
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No invoices yet — create one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
        }
      
