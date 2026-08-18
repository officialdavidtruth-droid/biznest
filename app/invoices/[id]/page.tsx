import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, FileText } from "lucide-react";
import { getInvoiceForCustomer } from "@/lib/actions/invoice";
import { PayInvoiceButton } from "@/components/invoices/pay-invoice-button";

const STATUS_STYLES: Record<string, string> = {
  SENT: "bg-amber-50 text-amber-700 ring-amber-200",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-gray-100 text-gray-600 ring-gray-200",
};

export default async function CustomerInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { id } = await params;
  const { payment } = await searchParams;
  const invoice = await getInvoiceForCustomer(id);
  if (!invoice) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="mx-auto max-w-lg px-6 py-12">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Invoice {invoice.invoiceNo}</h1>
            <p className="text-sm text-slate-500">from {invoice.store.name}</p>
          </div>
        </div>

        {payment === "failed" && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            <XCircle className="h-4 w-4 shrink-0" />
            Payment didn&apos;t go through. Please try again.
          </div>
        )}

        <div className="mb-4">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_STYLES[invoice.status] ?? "bg-gray-100 text-gray-600 ring-gray-200"}`}>
            {invoice.status === "PAID" && <CheckCircle2 className="h-3.5 w-3.5" />}
            {invoice.status}
          </span>
        </div>

        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          {invoice.items.map((item) => (
            <div key={item.id} className="flex justify-between py-1.5 text-sm">
              <span>
                {item.description} × {item.quantity}
              </span>
              <span className="font-medium">
                {invoice.currency} {(Number(item.unitPrice) * item.quantity).toLocaleString()}
              </span>
            </div>
          ))}
          <div className="mt-2 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{invoice.currency} {Number(invoice.subtotal).toLocaleString()}</span>
            </div>
            {Number(invoice.tax) > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Tax</span>
                <span>{invoice.currency} {Number(invoice.tax).toLocaleString()}</span>
              </div>
            )}
            {Number(invoice.discount) > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Discount</span>
                <span>-{invoice.currency} {Number(invoice.discount).toLocaleString()}</span>
              </div>
            )}
            {Number(invoice.deliveryFee) > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Delivery</span>
                <span>{invoice.currency} {Number(invoice.deliveryFee).toLocaleString()}</span>
              </div>
            )}
          </div>
          <div className="mt-2 flex justify-between border-t pt-3 text-base font-bold">
            <span>Total</span>
            <span>{invoice.currency} {Number(invoice.total).toLocaleString()}</span>
          </div>
        </div>

        {invoice.status === "SENT" && <PayInvoiceButton invoiceId={invoice.id} />}
        {invoice.status === "PAID" && (
          <p className="text-center text-sm font-medium text-emerald-700">This invoice has been paid. Thank you!</p>
        )}
        {invoice.status === "CANCELLED" && (
          <p className="text-center text-sm text-slate-500">This invoice was cancelled.</p>
        )}

        <div className="mt-6 text-center">
          <Link href={`/${invoice.store.slug}`} className="text-xs font-medium text-slate-500 hover:text-primary">
            Visit {invoice.store.name} →
          </Link>
        </div>
      </div>
    </div>
  );
}
