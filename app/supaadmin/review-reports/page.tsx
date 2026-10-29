import Link from "next/link";
import type { ReviewReportStatus } from "@prisma/client";
import { listReviewReports } from "@/lib/actions/review-reports";
import { REVIEW_REPORT_REASON_LABELS, REVIEW_REPORT_STATUS_CONFIG } from "@/lib/constants/review-report";
import { AdminReviewReportDecision } from "@/components/dashboard/admin-review-report-decision";
import { starEmpty, starFill } from "@/lib/utils/stars";
import { formatDate } from "@/lib/i18n/locale";

const TABS: { label: string; value: ReviewReportStatus | "ALL" }[] = [
  { label: "Open", value: "OPEN" },
  { label: "Removed", value: "UPHELD" },
  { label: "Kept", value: "DISMISSED" },
  { label: "All", value: "ALL" },
];

export default async function ReviewReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const activeTab: ReviewReportStatus | "ALL" =
    status === "UPHELD" || status === "DISMISSED" || status === "ALL" ? status : "OPEN";
  const reports = await listReviewReports(activeTab === "ALL" ? undefined : activeTab);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Review reports</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Reviews merchants have reported as abusive, spam, fake, off-topic or sharing private information. A low rating alone isn&apos;t grounds for
        removal.
      </p>

      <div className="mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "OPEN" ? "/supaadmin/review-reports" : `/supaadmin/review-reports?status=${t.value}`}
            className={`px-3 py-2 text-sm ${
              activeTab === t.value ? "border-b-2 border-primary font-medium text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {reports.map((r) => {
          const cfg = REVIEW_REPORT_STATUS_CONFIG[r.status];
          return (
            <div key={r.id} className="rounded-lg border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {r.store.name} <span className="font-normal text-muted-foreground">· reported by {r.reportedBy.name ?? r.reportedBy.email}</span>
                </p>
                <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${cfg.bg} ${cfg.text} ${cfg.ring}`}>{cfg.label}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {REVIEW_REPORT_REASON_LABELS[r.reason] ?? r.reason} · {formatDate(new Date(r.createdAt))}
              </p>
              {r.details && <p className="mt-2 text-sm">&ldquo;{r.details}&rdquo; <span className="text-xs text-muted-foreground">— merchant</span></p>}

              <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{r.reviewAuthorName?.trim() || "Customer"}</p>
                  <span role="img" aria-label={`${r.reviewRating} out of 5 stars`}>
                    <span aria-hidden="true">{starFill(r.reviewRating)}{starEmpty(r.reviewRating)}</span>
                  </span>
                </div>
                {r.reviewComment ? <p className="mt-1 whitespace-pre-line">{r.reviewComment}</p> : <p className="mt-1 italic text-muted-foreground">No comment — rating only.</p>}
                {r.review && r.review.images.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.review.images.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="Review photo" className="h-16 w-16 rounded-md border object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {r.status === "OPEN" ? (
                <AdminReviewReportDecision reportId={r.id} />
              ) : (
                r.adminNotes && <p className="mt-3 text-xs text-muted-foreground">Decision note: {r.adminNotes}</p>
              )}
            </div>
          );
        })}
        {reports.length === 0 && (
          <div className="rounded-lg border bg-background p-10 text-center text-muted-foreground">Nothing here.</div>
        )}
      </div>
    </div>
  );
}
