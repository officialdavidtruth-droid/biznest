import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Clock, FileSignature } from "lucide-react";
import { getQuoteForCustomer } from "@/lib/actions/quote";
import { QuoteActions } from "@/components/quotes/quote-actions";

const STATUS_STYLES: Record<string, string> = {
  SENT: "bg-amber-50 text-amber-700 ring-amber-200",
  ACCEPTED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DECLINED: "bg-gray-100 text-gray-600 ring-gray-200",
  EXPIRED: "bg-gray-100 text-gray-600 ring-gray-200",
};

export default async function CustomerQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { id } = await params;
  const { payment } = await searchParams;
  const quote = await getQuoteForCustomer(id);
  if (!quote) notFound();

  const isRespondable = quote.status === "SENT";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="mx-auto max-w-lg px-6 py-12">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileSignature className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Quote {quote.quoteNo}</h1>
            <p className="text-sm text-slate-500">from {quote.store.name}</p>
          </div>
        </div>

        {payment === "failed" && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            <XCircle className="h-4 w-4 shrink-0" />
            Your deposit payment didn&apos;t go through. Please try again.
          </div>
        )}

        <div className="mb-4">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_STYLES[quote.status] ?? "bg-gray-100 text-gray-600 ring-gray-200"}`}>
            {quote.status === "ACCEPTED" && <CheckCircle2 className="h-3.5 w-3.5" />}
            {quote.status}
          </span>
          {quote.expiresAt && isRespondable && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              Expires {new Date(quote.expiresAt).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          {quote.items.map((item) => (
            <div key={item.id} className="flex justify-between py-1.5 text-sm">
              <span>
                {item.description} × {item.quantity}
              </span>
              <span className="font-medium">
                {quote.currency} {(Number(item.unitPrice) * item.quantity).toLocaleString()}
              </span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t pt-3 text-base font-bold">
            <span>Total</span>
            <span>{quote.currency} {Number(quote.total).toLocaleString()}</span>
          </div>
          {quote.depositRequired && Number(quote.depositRequired) > 0 && (
            <div className="mt-1 flex justify-between text-sm text-slate-500">
              <span>Deposit required to accept</span>
              <span>{quote.currency} {Number(quote.depositRequired).toLocaleString()}</span>
            </div>
          )}
        </div>

        {isRespondable && (
          <QuoteActions quoteId={quote.id} hasDeposit={Boolean(quote.depositRequired && Number(quote.depositRequired) > 0)} />
        )}
        {quote.status === "ACCEPTED" && (
          <p className="text-center text-sm font-medium text-emerald-700">You&apos;ve accepted this quote.</p>
        )}
        {quote.status === "DECLINED" && (
          <p className="text-center text-sm text-slate-500">You declined this quote.</p>
        )}
        {quote.status === "EXPIRED" && (
          <p className="text-center text-sm text-slate-500">This quote has expired.</p>
        )}

        <div className="mt-6 text-center">
          <Link href={`/${quote.store.slug}`} className="text-xs font-medium text-slate-500 hover:text-primary">
            Visit {quote.store.name} →
          </Link>
        </div>
      </div>
    </div>
  );
}
