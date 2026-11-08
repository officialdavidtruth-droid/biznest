import Link from "next/link";
import { listBrowseReports } from "@/lib/actions/browse-admin";
import { REPORT_REASON_LABEL, type ReportReason } from "@/lib/browse";
import { AdminBrowseReportDecision } from "@/components/dashboard/admin-browse-report-decision";
import { formatDate } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

export default async function BrowseReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const tab = status === "RESOLVED" ? "RESOLVED" : "OPEN";
  const loaded = await listBrowseReports(tab);
  if (loaded === null) return <div className="rounded-lg border bg-background p-10 text-center text-sm text-muted-foreground">Your admin session has expired, so reports can't be shown. <Link href="/supaadmin" className="font-medium text-primary underline">Sign in again</Link> and reload this page.</div>;
  const groups = loaded;
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Browse reports</h1>
      <p className="mb-4 text-sm text-muted-foreground">Posts and comments on the public Browse feed that people have reported. Three different people reporting the same item hides it automatically until you decide.</p>
      <div className="mb-4 flex gap-1 border-b">
        {([["OPEN", "Open"], ["RESOLVED", "Resolved"]] as const).map(([v, label]) => (
          <Link key={v} href={v === "OPEN" ? "/supaadmin/browse-reports" : "/supaadmin/browse-reports?status=RESOLVED"} className={`px-3 py-2 text-sm ${tab === v ? "border-b-2 border-primary font-medium text-primary" : "text-muted-foreground hover:text-foreground"}`}>{label}</Link>
        ))}
      </div>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.targetKey} className="rounded-lg border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{g.storeName} <span className="font-normal text-muted-foreground">· {g.kind === "post" ? "post" : g.kind === "story" ? "story" : "comment on a post"} · {g.count} report{g.count === 1 ? "" : "s"}</span></p>
              <span className="text-xs text-muted-foreground">{formatDate(new Date(g.firstAt))}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{Object.entries(g.reasons).map(([r, n]) => `${REPORT_REASON_LABEL[r as ReportReason] ?? r} ×${n}`).join(" · ")}</p>
            <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
              {g.commentBody ? <><p className="text-xs text-muted-foreground">Comment:</p><p className="whitespace-pre-line">{g.commentBody}</p><p className="mt-2 text-xs text-muted-foreground">On post: {g.caption.slice(0, 120) || "(photo only)"}</p></> : <p className="whitespace-pre-line">{g.caption || "(photo only)"}</p>}
              {g.kind !== "comment" && g.images.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">{g.images.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Post photo" className="h-16 w-16 rounded-md border object-cover" /></a>
                ))}</div>
              )}
            </div>
            {tab === "OPEN" ? <AdminBrowseReportDecision targetKey={g.targetKey} kind={g.kind} /> : <p className="mt-2 text-xs text-muted-foreground">Decision: {g.status === "UPHELD" ? "removed" : "kept"}</p>}
          </div>
        ))}
        {groups.length === 0 && <div className="rounded-lg border bg-background p-10 text-center text-muted-foreground">Nothing here.</div>}
      </div>
    </div>
  );
}
