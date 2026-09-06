import Link from "next/link";
import { listQuotes } from "@/lib/actions/quote";
import { QuoteForm } from "@/components/dashboard/quote-form";
import { QuoteRowActions } from "@/components/dashboard/quote-row-actions";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-blue-50 text-blue-700",
  SENT: "bg-yellow-100 text-yellow-700",
  ACCEPTED: "bg-green-100 text-green-700",
  DECLINED: "bg-destructive/10 text-destructive",
  EXPIRED: "bg-gray-200 text-gray-700",
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
        <div className="overflow-x-auto">
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
              {quotes.map((quote) => (
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
                    {quote.budget != null ? `${quote.currency} ${Number(quote.budget).toLocaleString()}` : "Not specified"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[quote.status] ?? "bg-muted text-muted-foreground"}`}>
                      {quote.status === "DRAFT" && quote.creativeProject ? "NEW REQUEST" : quote.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(quote.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <QuoteRowActions storeSlug={slug} quoteId={quote.id} status={quote.status} incomingRequest={Boolean(quote.creativeProject)} />
                  </td>
                </tr>
              ))}
              {quotes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No quotes yet — create one above or wait for a customer request.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
