import Link from "next/link";
import { listAdCampaigns } from "@/lib/actions/ads-admin";
import { AdminAdActions } from "@/components/dashboard/admin-ad-actions";
import { AD_PLACEMENT_LABEL, type AdPlacement } from "@/lib/ads";
import { formatMoney } from "@/lib/utils/format-money";

export const dynamic = "force-dynamic";

export default async function AdsAdminPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const tab = view === "REPORTED" ? "REPORTED" : view === "ACTIVE" ? "ACTIVE" : "ALL";
  const rows = await listAdCampaigns(tab);
  const tabs = [["ALL", "All", "/supaadmin/ads"], ["ACTIVE", "Running", "/supaadmin/ads?view=ACTIVE"], ["REPORTED", "Reported", "/supaadmin/ads?view=REPORTED"]] as const;
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Browse ads</h1>
      <p className="mb-4 text-sm text-muted-foreground">Paid promotions on the public Browse feed and story row. Three different people reporting an ad pauses it automatically. Pause, resume or remove any campaign here.</p>
      <div className="mb-4 flex gap-1 border-b">
        {tabs.map(([v, label, href]) => <Link key={v} href={href} className={`px-3 py-2 text-sm ${tab === v ? "border-b-2 border-primary font-medium text-primary" : "text-muted-foreground hover:text-foreground"}`}>{label}</Link>)}
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{r.storeName} <span className="font-normal text-muted-foreground">· {AD_PLACEMENT_LABEL[r.placement as AdPlacement] ?? r.placement} · {r.statusLabel}{r.pausedBy ? ` (${r.pausedBy.toLowerCase()})` : ""}</span></p>
              <span className="text-xs text-muted-foreground">{formatMoney(r.spent, "NGN")} of {formatMoney(r.budget, "NGN")}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{r.impressions.toLocaleString("en-NG")} impressions · {r.clicks.toLocaleString("en-NG")} clicks · {r.reports} report{r.reports === 1 ? "" : "s"}</p>
            <div className="mt-3 flex gap-3 rounded-md bg-muted/40 p-3 text-sm">
              {r.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={r.imageUrl} target="_blank" rel="noreferrer"><img src={r.imageUrl} alt="Ad photo" className="h-16 w-16 rounded-md border object-cover" /></a>
              )}
              <p className="whitespace-pre-line">{r.caption || "(photo only)"}</p>
            </div>
            <AdminAdActions id={r.id} status={r.status} />
          </div>
        ))}
        {rows.length === 0 && <div className="rounded-lg border bg-background p-10 text-center text-muted-foreground">Nothing here.</div>}
      </div>
    </div>
  );
}
