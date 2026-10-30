import Link from "next/link";
import { listSupportRequests } from "@/lib/actions/support-request-admin";
import { AdminSupportRequestToggle } from "@/components/dashboard/admin-support-request-toggle";
import { formatDate } from "@/lib/i18n/locale";

const TABS: { label: string; value: "OPEN" | "RESOLVED" | "ALL" }[] = [
  { label: "Open", value: "OPEN" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "All", value: "ALL" },
];

export default async function SupportRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const activeTab: "OPEN" | "RESOLVED" | "ALL" = status === "RESOLVED" || status === "ALL" ? status : "OPEN";
  const requests = await listSupportRequests(activeTab === "ALL" ? undefined : activeTab);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Support requests</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Messages merchants sent from the dashboard help chat. Reply by email to the address shown, then mark the request resolved.
      </p>

      <div className="mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "OPEN" ? "/supaadmin/support-requests" : `/supaadmin/support-requests?status=${t.value}`}
            className={`px-3 py-2 text-sm ${
              activeTab === t.value ? "border-b-2 border-primary font-medium text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {requests.length === 0 && <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">No requests here.</p>}

      <div className="space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="rounded-lg border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {r.storeName ?? "Unknown store"}
                {r.storeSlug && <span className="font-normal text-muted-foreground"> · /{r.storeSlug}</span>}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${
                  r.status === "OPEN" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"
                }`}
              >
                {r.status === "OPEN" ? "Open" : "Resolved"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {r.userName ?? "Unknown"}
              {r.userEmail && (
                <>
                  {" "}· <a href={`mailto:${r.userEmail}`} className="text-primary underline">{r.userEmail}</a>
                </>
              )}{" "}
              · {formatDate(new Date(r.createdAt))}
              {!r.emailSent && " · alert email not sent"}
            </p>
            <p className="mt-3 whitespace-pre-line text-sm">{r.message}</p>
            {r.transcript && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Chat so far</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs">{r.transcript}</pre>
              </details>
            )}
            <div className="mt-3 flex items-center gap-2">
              <AdminSupportRequestToggle id={r.id} status={r.status} />
              {r.storeSlug && (
                <Link href={`/store/${r.storeSlug}/admin`} className="text-xs text-muted-foreground underline">Open store dashboard</Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
