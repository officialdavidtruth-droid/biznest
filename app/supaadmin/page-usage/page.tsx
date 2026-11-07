import Link from "next/link";
import { getPageUsage } from "@/lib/actions/admin";
import { TableScroll } from "@/components/ui/table-scroll";

export const dynamic = "force-dynamic";

const RANGES = [1, 7, 30, 90];
const AREAS = ["Seller dashboard", "Storefront", "Platform pages"];

function href(days: number, area?: string) {
  const q = new URLSearchParams({ days: String(days) });
  if (area) q.set("area", area);
  return `/supaadmin/page-usage?${q}`;
}

export default async function PageUsagePage({ searchParams }: { searchParams: Promise<{ days?: string; area?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 7;
  const area = AREAS.includes(sp.area ?? "") ? sp.area : undefined;
  const report = await getPageUsage(days, area);
  const top = report.pages[0]?.views ?? 1;
  const peak = Math.max(1, ...report.daily.map((d) => d.views));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Page usage</h1>
        <p className="text-sm text-muted-foreground">
          Which pages get opened most. Store addresses show as [store] and record ids as [id], so similar pages count together.
          Counting began when this feature went live.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {RANGES.map((r) => (
          <Link key={r} href={href(r, area)} className={`rounded-full border px-3 py-1 ${r === days ? "bg-primary text-primary-foreground" : "bg-background"}`}>
            {r === 1 ? "Today" : `${r} days`}
          </Link>
        ))}
        <span className="mx-1 text-muted-foreground">|</span>
        <Link href={href(days)} className={`rounded-full border px-3 py-1 ${!area ? "bg-primary text-primary-foreground" : "bg-background"}`}>All</Link>
        {AREAS.map((a) => (
          <Link key={a} href={href(days, a)} className={`rounded-full border px-3 py-1 ${a === area ? "bg-primary text-primary-foreground" : "bg-background"}`}>{a}</Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs text-muted-foreground">Total page views</p>
          <p className="text-2xl font-semibold">{report.totalViews.toLocaleString()}</p>
        </div>
        {report.byArea.map((a) => (
          <div key={a.area} className="rounded-lg border bg-background p-4">
            <p className="text-xs text-muted-foreground">{a.area}</p>
            <p className="text-2xl font-semibold">{a.views.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {report.daily.length > 1 && (
        <div className="rounded-lg border bg-background p-4">
          <p className="mb-3 text-sm font-medium">Views per day</p>
          <div className="flex h-24 items-end gap-1">
            {report.daily.map((d) => (
              <div key={d.day} className="group flex flex-1 flex-col items-center justify-end" title={`${d.day}: ${d.views}`}>
                <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(4, (d.views / peak) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{report.daily[0].day}</span>
            <span>{report.daily[report.daily.length - 1].day}</span>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-background">
        <TableScroll>
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Page</th>
                <th className="px-4 py-2">Area</th>
                <th className="px-4 py-2 text-right">Views</th>
                <th className="px-4 py-2 text-right">Signed in</th>
              </tr>
            </thead>
            <tbody>
              {report.pages.map((p) => (
                <tr key={`${p.area}:${p.path}`} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="font-mono text-xs">{p.path}</p>
                    <div className="mt-1 h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary/70" style={{ width: `${(p.views / top) * 100}%` }} /></div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.area}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{p.views.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{p.signedInViews.toLocaleString()}</td>
                </tr>
              ))}
              {report.pages.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No page views recorded for this range yet.</td></tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </div>
    </div>
  );
}
