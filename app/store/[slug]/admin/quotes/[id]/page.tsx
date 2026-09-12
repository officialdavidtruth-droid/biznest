import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink, FileImage, FileText, Mail, MessageSquareText, Paperclip, Phone, UserRound } from "lucide-react";
import { getQuote } from "@/lib/actions/quote";
import { QuoteRowActions } from "@/components/dashboard/quote-row-actions";
import type { Prisma } from "@prisma/client";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-blue-50 text-blue-700 ring-blue-200",
  SENT: "bg-yellow-50 text-yellow-700 ring-yellow-200",
  ACCEPTED: "bg-green-50 text-green-700 ring-green-200",
  DECLINED: "bg-red-50 text-red-700 ring-red-200",
  EXPIRED: "bg-gray-100 text-gray-600 ring-gray-200",
};

type ReferenceFile = { url: string; name?: string; type?: string; size?: number };

function getReferenceFiles(value: Prisma.JsonValue | null | undefined): ReferenceFile[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item) || !("url" in item)) return [];
    const url = item.url;
    if (typeof url !== "string" || !url) return [];
    return [{
      url,
      name: typeof item.name === "string" ? item.name : undefined,
      type: typeof item.type === "string" ? item.type : undefined,
      size: typeof item.size === "number" ? item.size : undefined,
    }];
  });
}

function formatBytes(size?: number) {
  if (!size) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function QuoteDetailPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const quote = await getQuote(slug, id);
  if (!quote) notFound();

  const references = getReferenceFiles(quote.referenceFiles);
  const project = quote.creativeProject;
  const budget = quote.budget != null ? Number(quote.budget) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href={`/store/${slug}/admin/quotes`} className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to quotes</Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{quote.quoteNo}</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATUS_STYLES[quote.status] ?? "bg-muted text-muted-foreground ring-border"}`}>{quote.status === "DRAFT" && project ? "NEW REQUEST" : quote.status}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Submitted {new Date(quote.createdAt).toLocaleString()}</p>
        </div>
        <QuoteRowActions storeSlug={slug} quoteId={quote.id} status={quote.status} incomingRequest={Boolean(project)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <main className="space-y-6">
          <section className="rounded-2xl border bg-background p-6">
            <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary"><MessageSquareText className="h-5 w-5" /></div><div><h2 className="font-semibold">Customer request</h2><p className="text-xs text-muted-foreground">The exact brief submitted from your storefront.</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Service</p><p className="mt-1 font-medium">{quote.serviceType ?? quote.items[0]?.description ?? "—"}</p></div>
              <div className="rounded-xl border p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Requested amount / budget</p><p className="mt-1 text-lg font-bold">{budget != null ? `${quote.currency} ${budget.toLocaleString()}` : "Not specified"}</p></div>
              <div className="rounded-xl border p-4 sm:col-span-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Brief</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{quote.brief ?? "No written brief was supplied."}</p></div>
              {quote.deadline && <div className="rounded-xl border p-4 sm:col-span-2"><p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Deadline</p><p className="mt-1 font-medium">{new Date(quote.deadline).toLocaleDateString()}</p></div>}
            </div>
          </section>

          <section className="rounded-2xl border bg-background p-6">
            <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary"><Paperclip className="h-5 w-5" /></div><div><h2 className="font-semibold">Reference files</h2><p className="text-xs text-muted-foreground">Files the customer uploaded to show what they want to achieve.</p></div></div>
            {references.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No reference files were uploaded.</div> : <div className="grid gap-3 sm:grid-cols-2">{references.map((file) => { const isPdf = file.type === "application/pdf" || file.url.toLowerCase().includes(".pdf"); return <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl border p-3 transition hover:border-primary/40 hover:bg-muted/30"><div className="rounded-lg bg-muted p-2">{isPdf ? <FileText className="h-5 w-5 text-red-500" /> : <FileImage className="h-5 w-5 text-primary" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name ?? "Reference file"}</p>{file.size ? <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p> : null}</div><ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" /></a>; })}</div>}
          </section>

          {project && <section className="rounded-2xl border bg-background p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project workflow</p><h2 className="mt-1 font-semibold">{project.projectNo}</h2><p className="mt-1 text-sm text-muted-foreground">Design and production workflow is linked to this quote.</p></div><Link href={`/store/${slug}/admin/projects/${project.id}`} className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted">Open project</Link></div></section>}
        </main>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-background p-6">
            <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary"><UserRound className="h-5 w-5" /></div><div><h2 className="font-semibold">Customer</h2><p className="text-xs text-muted-foreground">Contact details</p></div></div>
            <div className="space-y-4 text-sm">
              <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Name</p><p className="mt-1 font-medium">{quote.customerName ?? "Customer"}</p></div>
              {quote.customerEmail && <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Email</p><a href={`mailto:${quote.customerEmail}`} className="mt-1 flex items-center gap-2 font-medium text-primary hover:underline"><Mail className="h-4 w-4" />{quote.customerEmail}</a></div>}
              {quote.customerPhone && <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Phone / WhatsApp</p><a href={`tel:${quote.customerPhone}`} className="mt-1 flex items-center gap-2 font-medium text-primary hover:underline"><Phone className="h-4 w-4" />{quote.customerPhone}</a></div>}
            </div>
          </section>

          <section className="rounded-2xl border bg-background p-6"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Quote summary</p><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><span className="text-muted-foreground">Requested budget</span><span className="font-semibold">{budget != null ? `${quote.currency} ${budget.toLocaleString()}` : "Not specified"}</span></div><div className="flex justify-between gap-4 border-t pt-3"><span className="text-muted-foreground">Current quote total</span><span className="font-bold">{quote.currency} {Number(quote.total).toLocaleString()}</span></div><p className="pt-1 text-xs leading-5 text-muted-foreground">The customer&apos;s budget is the amount they said they want to spend. Review the brief before preparing the final quote.</p></div></section>
        </aside>
      </div>
    </div>
  );
}
