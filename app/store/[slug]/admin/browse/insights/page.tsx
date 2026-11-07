import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { INSIGHT_RANGES, loadBrowseInsights, type InsightRange } from "@/lib/browse-insights";
import { formatNumber } from "@/lib/i18n/locale";
import { timeAgo } from "@/lib/browse";
import { TableScroll } from "@/components/ui/table-scroll";

export const dynamic = "force-dynamic";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ range?: string }> }) {
  const { slug } = await params;
  const { range } = await searchParams;
  const days = (INSIGHT_RANGES.find((r) => String(r) === range) ?? 30) as InsightRange;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, currency: true } });
  if (!store) notFound();
  const d = await loadBrowseInsights(store.id, days);
  const base = `/store/${slug}/admin/browse/insights`;
  const n = (v: number) => formatNumber(v);
  const money = (v: number) => `${store.currency ?? "NGN"} ${formatNumber(v)}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">How your Browse presence is doing over the last {days} days.</p>
        <div className="flex gap-1" role="tablist" aria-label="Time range">
          {INSIGHT_RANGES.map((r) => (
            <Link key={r} role="tab" aria-selected={r === days} href={`${base}?range=${r}`} className={`rounded-full px-3 py-1 text-xs font-medium ${r === days ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}>{r} days</Link>
          ))}
        </div>
      </div>

      <section aria-labelledby="reach">
        <h2 id="reach" className="mb-3 text-sm font-semibold">Reach</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Post impressions" value={n(d.impressions)} hint="Times your posts were seen in the feed" />
          <Stat label="Profile views" value={n(d.profileViews)} hint="Visits to your Browse profile" />
          <Stat label="Shares" value={n(d.shares)} hint="Posts and profile shared" />
          <Stat label="Story views" value={n(d.storyViews)} />
        </div>
      </section>

      <section aria-labelledby="audience">
        <h2 id="audience" className="mb-3 text-sm font-semibold">Audience and engagement</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Followers" value={n(d.followers)} hint={d.newFollowers > 0 ? `${n(d.newFollowers)} new in ${days} days` : `None new in ${days} days`} />
          <Stat label="Likes" value={n(d.likes)} hint="On your published posts" />
          <Stat label="Comments" value={n(d.comments)} hint="On your published posts" />
        </div>
      </section>

      <section aria-labelledby="ads">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="ads" className="text-sm font-semibold">Ad performance</h2>
          <Link href={`/store/${slug}/admin/ads`} className="text-sm font-medium text-primary hover:underline">Manage ads</Link>
        </div>
        {d.ads.campaigns === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">You haven&apos;t run an ad yet. Promote a post or your store to reach more people on Browse.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Ad impressions" value={n(d.ads.impressions)} hint="All campaigns, all time" />
            <Stat label="Ad clicks" value={n(d.ads.clicks)} />
            <Stat label="Click rate" value={`${d.ads.ctr}%`} />
            <Stat label="Spent" value={money(d.ads.spent)} hint={`${d.ads.active} running of ${d.ads.campaigns}`} />
          </div>
        )}
      </section>

      <section aria-labelledby="posts">
        <h2 id="posts" className="mb-3 text-sm font-semibold">Your recent posts</h2>
        {d.posts.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Nothing yet. Post an update from the My posts tab and its numbers show up here.</p>
        ) : (
          <TableScroll className="rounded-lg border bg-background">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr><th className="px-4 py-2">Post</th><th className="px-4 py-2">Impressions</th><th className="px-4 py-2">Shares</th><th className="px-4 py-2">Likes</th><th className="px-4 py-2">Comments</th></tr>
              </thead>
              <tbody>
                {d.posts.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="max-w-[320px] px-4 py-3"><p className="truncate">{p.caption || "Photo post"}</p><p className="text-xs text-muted-foreground">{timeAgo(new Date(p.createdAt))}</p></td>
                    <td className="px-4 py-3">{n(p.impressions)}</td>
                    <td className="px-4 py-3">{n(p.shares)}</td>
                    <td className="px-4 py-3">{n(p.likes)}</td>
                    <td className="px-4 py-3">{n(p.comments)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Impressions, profile views and shares are counted from when this feature went live, and your own views are not counted.</p>
      </section>
    </div>
  );
}
