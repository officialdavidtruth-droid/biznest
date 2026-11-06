import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/browse-viewer";
import { loadBrowseFeed, loadDiscoverShops, loadFollowedShops, loadFollowedStoreIds } from "@/lib/browse-data";
import { BrowseFeed } from "@/components/browse/browse-feed";
import { BrowseShell } from "@/components/browse/browse-shell";
import { DiscoverShops } from "@/components/browse/discover-shops";
import { isOfficialSlug } from "@/lib/browse";
import { StoreBadges } from "@/components/browse/store-badges";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Following — BizNest Browse", robots: { index: false } };

const display = "font-[family-name:var(--font-browse-display)]";
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5B82E]";

export default async function FollowingPage() {
  const viewer = await getViewer();
  if (!viewer?.userId) redirect("/join?callbackUrl=%2Fbrowse%2Ffollowing");
  const [storeIds, shops] = await Promise.all([loadFollowedStoreIds(viewer.key), loadFollowedShops(viewer.key)]);
  const [feed, suggestions] = await Promise.all([
    loadBrowseFeed({ viewerKey: viewer.key, storeIds }),
    storeIds.length === 0 ? loadDiscoverShops(6) : Promise.resolve([]),
  ]);

  return (
    <BrowseShell back={{ href: "/browse", label: "Browse" }}>
      <main className="mx-auto max-w-[600px] px-4 pb-20 pt-6">
        <h1 className={`${display} mb-5 text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl`}>Following</h1>

        {shops.length > 0 && (
          <ul className="mb-6 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]" aria-label="Businesses you follow">
            {shops.map((s) => (
              <li key={s.slug} className="shrink-0">
                <Link href={`/browse/s/${s.slug}`} className={`flex w-24 flex-col items-center gap-2 rounded-2xl bg-white/[0.06] p-3 text-center hover:bg-white/10 ${focus}`}>
                  {s.logoUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={s.logoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
                    : <span className="grid h-14 w-14 place-items-center rounded-full bg-[#F5B82E] text-lg font-extrabold text-[#14301A]">{s.name.slice(0, 1).toUpperCase()}</span>}
                  <span className="line-clamp-2 text-xs font-medium leading-tight">{s.name}</span>
                  <StoreBadges verified={s.verified} mogul={s.mogul} official={isOfficialSlug(s.slug)} />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {storeIds.length === 0 ? (
          <div className="space-y-6">
            <section className="rounded-[28px] bg-[#FBF6E9] px-6 py-8 text-center text-[#14301A]">
              <h2 className={`${display} text-2xl font-extrabold tracking-tight`}>You&apos;re not following anyone yet</h2>
              <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-[#14301A]/75">Follow a business and its new posts show up here.</p>
              <Link href="/browse" className={`mt-5 inline-flex rounded-full bg-[#14301A] px-5 py-2.5 text-sm font-semibold text-[#FBF6E9] ${focus}`}>Browse businesses</Link>
            </section>
            <DiscoverShops shops={suggestions} />
          </div>
        ) : feed.posts.length === 0 ? (
          <p className="rounded-2xl bg-white/[0.06] p-6 text-center text-[15px] text-[#FBF6E9]/80">The businesses you follow haven&apos;t posted yet. New posts will show up here.</p>
        ) : (
          <BrowseFeed initialPosts={feed.posts} initialCursor={feed.nextCursor} sort="latest" category={null} following />
        )}
      </main>
    </BrowseShell>
  );
}
