import { BrowseTabs } from "@/components/browse/browse-tabs";
import { recordCategoryInterest } from "@/lib/browse-interest";
import { INTEREST_WEIGHT } from "@/lib/browse-foryou";
import { TagSearch } from "@/components/browse/tag-search";
import Link from "next/link";
import type { Metadata } from "next";
import { getViewer } from "@/lib/browse-viewer";
import { loadBrowseCategories, loadBrowseFeed, loadTrendingTags, loadDiscoverShops, loadStoryRings, type FeedSort } from "@/lib/browse-data";
import { loadLiveAds, adToRing } from "@/lib/ads-data";
import { injectRingAds } from "@/lib/ads";
import { BrowseFeed } from "@/components/browse/browse-feed";
import { StoryRings } from "@/components/browse/story-rings";
import { BrowseShell } from "@/components/browse/browse-shell";
import { Awning } from "@/components/browse/awning";
import { DiscoverShops, SellCta } from "@/components/browse/discover-shops";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse: what Nigerian businesses are posting — BizNest",
  description: "See new products and daily updates from Nigerian shops, restaurants, hotels and service providers. Like, comment and tap through to their stores.",
  alternates: { canonical: "/browse" },
};

const display = "font-[family-name:var(--font-browse-display)]";
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5B82E]";

export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ sort?: string; category?: string }> }) {
  const sp = await searchParams;
  const sort: FeedSort = sp.sort === "popular" ? "popular" : sp.sort === "latest" ? "latest" : "foryou";
  const category = sp.category?.trim().slice(0, 80) || null;
  const viewer = await getViewer();
  if (category && viewer) void recordCategoryInterest(viewer.key, category, INTEREST_WEIGHT.CATEGORY);
  const [feed, categories, organicRings, feedAds, storyAds, shops, trending] = await Promise.all([
    loadBrowseFeed({ sort, category, viewerKey: viewer?.key }), loadBrowseCategories(), loadStoryRings(viewer?.key),
    loadLiveAds("FEED", viewer?.key, 2), loadLiveAds("STORY", viewer?.key, 2), loadDiscoverShops(6), loadTrendingTags(12).catch(() => []),
  ]);
  const rings = injectRingAds(organicRings, storyAds).map((x) => x.ring ?? adToRing(x.ad!));
  const href = (next: { sort?: FeedSort; category?: string | null }) => {
    const q = new URLSearchParams();
    const s = next.sort ?? sort; const c = next.category === undefined ? category : next.category;
    if (s === "popular" || s === "latest") q.set("sort", s);
    if (c) q.set("category", c);
    const qs = q.toString();
    return qs ? `/browse?${qs}` : "/browse";
  };
  const seg = (active: boolean) => `rounded-full px-4 py-1.5 text-sm font-semibold transition ${focus} ${active ? "bg-[#FBF6E9] text-[#14301A] shadow" : "text-[#FBF6E9]/80 hover:text-white"}`;
  const chip = (active: boolean) => `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${focus} ${active ? "bg-[#F5B82E] text-[#14301A]" : "bg-white/10 text-[#FBF6E9]/90 hover:bg-white/15"}`;

  return (
    <BrowseShell>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 pb-20 pt-4 lg:grid-cols-[minmax(0,500px)_320px] lg:gap-10 lg:justify-center">
        <div className="min-w-0">
          <h1 className={`${display} mb-3 text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl lg:mb-3 lg:text-3xl`}>New from shops<br className="sm:hidden" /> across Nigeria</h1>

          <BrowseTabs active="foryou" />

          <StoryRings rings={rings} />

          <TagSearch trending={trending} />

          <div className="sticky top-14 z-20 -mx-4 mb-3 flex flex-wrap items-center gap-2 bg-gradient-to-b from-[#0A2012] via-[#0A2012]/95 to-transparent px-4 pb-3 pt-2">
            <div className="inline-flex rounded-full bg-black/25 p-1 ring-1 ring-white/10" role="tablist" aria-label="Sort posts">
              <Link role="tab" aria-selected={sort === "foryou"} href={href({ sort: "foryou" })} className={seg(sort === "foryou")}>For you</Link>
              <Link role="tab" aria-selected={sort === "latest"} href={href({ sort: "latest" })} className={seg(sort === "latest")}>Latest</Link>
              <Link role="tab" aria-selected={sort === "popular"} href={href({ sort: "popular" })} className={seg(sort === "popular")}>Popular</Link>
            </div>
            {categories.length > 0 && (
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none]" aria-label="Categories">
                <Link href={href({ category: null })} className={chip(!category)}>All</Link>
                {categories.map((c) => <Link key={c} href={href({ category: c })} className={chip(category === c)}>{c}</Link>)}
              </div>
            )}
          </div>

          {feed.posts.length === 0 ? (
            <div className="space-y-6">
              <section className="overflow-hidden rounded-[28px] bg-[#FBF6E9] text-[#14301A] shadow-[0_18px_40px_-20px_rgba(0,0,0,.65)]">
                <Awning />
                <div className="px-6 pb-8 pt-6 text-center">
                  <h2 className={`${display} text-2xl font-extrabold tracking-tight`}>{category ? `No ${category} posts yet` : "No posts yet"}</h2>
                  <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-[#14301A]/75">
                    {category ? "Shops in this category haven't posted anything. Try another category, or visit a shop directly." : "When shops share new products and updates, they show up here. In the meantime, visit a shop."}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {category && <Link href="/browse" className={`rounded-full bg-[#14301A] px-5 py-2.5 text-sm font-semibold text-[#FBF6E9] ${focus}`}>See all posts</Link>}
                    <Link href="/search" className={`rounded-full px-5 py-2.5 text-sm font-semibold ${focus} ${category ? "border border-[#14301A]/25" : "bg-[#14301A] text-[#FBF6E9]"}`}>Find businesses</Link>
                  </div>
                </div>
              </section>
              <div className="lg:hidden"><DiscoverShops shops={shops} /></div>
              <div className="lg:hidden"><SellCta /></div>
            </div>
          ) : (
            <BrowseFeed key={`${sort}|${category ?? ""}`} initialPosts={feed.posts} initialCursor={feed.nextCursor} initialAds={feedAds} sort={sort} category={category} />
          )}
        </div>

        <aside className="hidden lg:block" aria-label="Discover">
          <div className="sticky top-20 space-y-4">
            <DiscoverShops shops={shops} />
            <SellCta />
          </div>
        </aside>
      </main>
    </BrowseShell>
  );
}
