import Link from "next/link";
import { listQuotes } from "@/lib/actions/quote";
import { QuoteForm } from "@/components/dashboard/quote-form";
import { QuoteRowActions } from "@/components/dashboard/quote-row-actions";
import { formatDate, formatNumber } from "@/lib/i18n/locale";
import { effectiveQuoteStatus } from "@/lib/quotes/expiry";
import { TableScroll } from "@/components/ui/table-scroll";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)]",
  SENT: "bg-[var(--bn-admin-orange-soft)] text-[var(--bn-admin-orange)]",
  ACCEPTED: "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)]",
  DECLINED: "bg-destructive/10 text-destructive",
  EXPIRED: "bg-[var(--bn-admin-surface)] text-[var(--bn-admin-text)]",
};

export default async function QuotesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const quotes = await listQuotes(slug);
  const incoming = quotes.filter((quote) => quote.creativeProject).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Quotes</h1>
            <p className="mt-1 text-sm text-muted-foreground">Every quote request from your website is registered here with the full customer brief.</p>
          </div>
          {incoming > 0 && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{incoming} website request{incoming === 1 ? "" : "s"}</span>
          )}
        </div>
      </div>

      <QuoteForm storeSlug={slug} />

      <div className="overflow-hidden rounded-xl border bg-background">
        <TableScroll>
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Quote</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const status = effectiveQuoteStatus(quote);
                return (
                <tr key={quote.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <Link href={`/store/${slug}/admin/quotes/${quote.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                      {quote.quoteNo}
                    </Link>
                    {quote.creativeProject && <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Website request</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/store/${slug}/admin/quotes/${quote.id}`} className="font-medium hover:text-primary">
                      {quote.customer?.name ?? quote.customerName ?? "—"}
                    </Link>
                    {(quote.customerEmail || quote.customerPhone) && (
                      <p className="mt-1 text-xs text-muted-foreground">{quote.customerEmail || quote.customerPhone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{quote.serviceType ?? quote.items[0]?.description ?? "—"}</td>
                  <td className="px-4 py-3">
                    {quote.budget != null ? `${quote.currency} ${formatNumber(Number(quote.budget))}` : "Not specified"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
                      {status === "DRAFT" && quote.creativeProject ? "NEW REQUEST" : status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(new Date(quote.createdAt))}</td>
                  <td className="px-4 py-3">
                    <QuoteRowActions storeSlug={slug} quoteId={quote.id} status={status} incomingRequest={Boolean(quote.creativeProject)} />
                  </td>
                </tr>
                );
              })}
              {quotes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No quotes yet — create one above or wait for a customer request.</td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </div>
    </div>
  );
}
