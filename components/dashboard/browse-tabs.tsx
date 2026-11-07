import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getViewer } from "@/lib/browse-viewer";
import { loadBrowseFeed, loadStoryRings, loadVendorBrowse, loadVendorStories, type FeedSort } from "@/lib/browse-data";
import { BROWSE_DAILY_POST_LIMIT, timeAgo } from "@/lib/browse";
import { BrowseWorkspace } from "@/components/dashboard/browse-workspace";
import { BrowseFeed } from "@/components/browse/browse-feed";
import { StoryRings } from "@/components/browse/story-rings";

/** What a business owner is told about their Browse presence. */
export const ACTIVITY_TYPES = ["BROWSE_COMMENT", "BROWSE_LIKE", "BROWSE_FOLLOW", "BROWSE_REMOVED", "BROWSE_TAG"];

export async function FeedTab({ base, sort }: { base: string; sort: FeedSort }) {
  const viewer = await getViewer();
  const [feed, rings] = await Promise.all([loadBrowseFeed({ sort, category: null, viewerKey: viewer?.key }), loadStoryRings(viewer?.key)]);
  const seg = (active: boolean) => `rounded-full px-4 py-1.5 text-sm font-semibold ${active ? "bg-[#FBF6E9] text-[#14301A]" : "text-[#FBF6E9]/80 hover:text-white"}`;
  return (
    <div className="mx-auto max-w-[620px] rounded-3xl bg-[#0A2012] p-4 text-[#FBF6E9]">
      <StoryRings rings={rings} />
      <div className="mb-4 mt-3 inline-flex rounded-full bg-black/25 p-1 ring-1 ring-white/10" role="tablist" aria-label="Sort posts">
        <Link role="tab" aria-selected={sort === "latest"} href={`${base}?tab=feed`} className={seg(sort === "latest")}>Latest</Link>
        <Link role="tab" aria-selected={sort === "popular"} href={`${base}?tab=feed&sort=popular`} className={seg(sort === "popular")}>Popular</Link>
      </div>
      {feed.posts.length === 0 ? (
        <p className="rounded-2xl bg-white/[0.06] p-6 text-center text-[15px] text-[#FBF6E9]/80">No posts yet. When businesses share updates, they show up here.</p>
      ) : (
        <BrowseFeed key={sort} initialPosts={feed.posts} initialCursor={feed.nextCursor} sort={sort} category={null} />
      )}
    </div>
  );
}

export async function PostsTab({ slug, store }: { slug: string; store: { id: string; status: string; business: { searchVisible: boolean } | null; products: { id: string; name: string }[]; services?: { id: string; name: string }[] } }) {
  const [data, stories] = await Promise.all([loadVendorBrowse(store.id), loadVendorStories(store.id)]);
  return (
    <>
      {store.status !== "ACTIVE" && <p role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Your store isn&apos;t active, so new posts are paused.</p>}
      {store.business?.searchVisible === false && <p className="mb-4 rounded-lg border bg-muted/40 p-3 text-sm">Your business is hidden from public discovery, so your posts won&apos;t appear in the feed. Turn this on in Settings to be listed.</p>}
      <BrowseWorkspace slug={slug} data={data} stories={stories} products={store.products} services={store.services ?? []} dailyLimit={BROWSE_DAILY_POST_LIMIT} />
    </>
  );
}

export async function ActivityTab({ userId }: { userId: string }) {
  const rows = await prisma.notification.findMany({
    where: { userId, type: { in: ACTIVITY_TYPES } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, type: true, title: true, body: true, readAt: true, createdAt: true },
  });
  if (rows.some((r) => !r.readAt)) {
    await prisma.notification.updateMany({ where: { userId, type: { in: ACTIVITY_TYPES }, readAt: null }, data: { readAt: new Date() } });
  }
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nothing yet. Likes, comments and new followers on your Browse posts show up here.</p>;
  }
  return (
    <ul className="max-w-xl space-y-2">
      {rows.map((r) => (
        <li key={r.id} className={`rounded-xl border bg-background p-3 ${r.readAt ? "" : "border-primary/40"}`}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium">{r.title}</p>
            <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{r.body}</p>
        </li>
      ))}
    </ul>
  );
}
