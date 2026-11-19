// Route: /store/[slug]/admin/invoices
import { listInvoices } from "@/lib/actions/invoice";
import { InvoiceForm } from "@/components/dashboard/invoice-form";
import { InvoiceRowActions } from "@/components/dashboard/invoice-row-actions";
import { prisma } from "@/lib/prisma";
import { formatDate, formatNumber } from "@/lib/i18n/locale";
import { getInHouseReservations } from "@/lib/actions/folio";
import { planGate } from "@/lib/entitlements/plan-features";
import { PlanUpgradeNotice } from "@/components/dashboard/plan-upgrade-notice";

const STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", SENT: "Awaiting payment", PAID: "Paid", CANCELLED: "Cancelled" };

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-[var(--bn-admin-surface)] text-[var(--bn-admin-text)]",
  SENT: "bg-[var(--bn-admin-orange-soft)] text-[var(--bn-admin-orange)]",
  PAID: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export default async function InvoicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await planGate({ slug }, "invoices");
  if (!gate.ok) return <PlanUpgradeNotice slug={slug} title="Invoices" message={gate.message} />;
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

  const sum = (st: string) => invoices.filter((i) => i.status === st).reduce((t, i) => t + Number(i.total), 0);
  const outstanding = sum("SENT");
  const paid = sum("PAID");
  const drafts = invoices.filter((i) => i.status === "DRAFT").length;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Invoices</h1>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 rounded-2xl border bg-background p-4 shadow-sm sm:col-span-1">
          <p className="text-xs text-muted-foreground">Waiting to be paid</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{currency} {formatNumber(outstanding)}</p>
        </div>
        <div className="rounded-2xl border bg-background p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Paid</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700">{currency} {formatNumber(paid)}</p>
        </div>
        <div className="rounded-2xl border bg-background p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Drafts</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{drafts}</p>
        </div>
      </div>

      <InvoiceForm storeSlug={slug} currency={currency} defaultOpen={invoices.length === 0} />

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          No invoices yet. Fill in the form above and tap Create invoice.
        </div>
      ) : (
        <ul className="space-y-3">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="rounded-2xl border bg-background p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{invoice.customer?.name ?? invoice.customerName ?? "No customer name"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="font-mono">{invoice.invoiceNo}</span> · {formatDate(new Date(invoice.createdAt))}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold tabular-nums">{invoice.currency} {formatNumber(Number(invoice.total))}</p>
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[invoice.status]}`}>
                    {STATUS_LABEL[invoice.status] ?? invoice.status}
                  </span>
                </div>
              </div>
              <div className="mt-3 border-t pt-3">
                <InvoiceRowActions storeSlug={slug} invoiceId={invoice.id} status={invoice.status} rooms={rooms} postedTo={roomByInvoice.get(invoice.id) ?? null} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
