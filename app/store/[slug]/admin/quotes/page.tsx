// Route: /store/[slug]/admin/quotes
import { listQuotes } from "@/lib/actions/quote";
import { QuoteForm } from "@/components/dashboard/quote-form";
import { QuoteRowActions } from "@/components/dashboard/quote-row-actions";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-200 text-gray-700",
  SENT: "bg-yellow-100 text-yellow-700",
  ACCEPTED: "bg-green-100 text-green-700",
  DECLINED: "bg-destructive/10 text-destructive",
  EXPIRED: "bg-gray-200 text-gray-700",
};

export default async function QuotesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const quotes = await listQuotes(slug);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Quotes</h1>

      <QuoteForm storeSlug={slug} />

      <div className="overflow-hidden rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Quote</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Deposit</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr key={quote.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{quote.quoteNo}</td>
                <td className="px-4 py-3">{quote.customer?.name ?? quote.customerName ?? "—"}</td>
                <td className="px-4 py-3">
                  {quote.currency} {Number(quote.total).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {quote.depositRequired ? `${quote.currency} ${Number(quote.depositRequired).toLocaleString()}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[quote.status]}`}>
                    {quote.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(quote.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <QuoteRowActions storeSlug={slug} quoteId={quote.id} status={quote.status} />
                </td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No quotes yet — create one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
