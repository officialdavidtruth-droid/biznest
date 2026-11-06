import Link from "next/link";
import type { Metadata } from "next";
import { getViewer } from "@/lib/browse-viewer";
import { loadBrowseCategories, loadBrowseFeed, loadStoryRings, type FeedSort } from "@/lib/browse-data";
import { BrowseFeed } from "@/components/browse/browse-feed";
import { StoryRings } from "@/components/browse/story-rings";
import { loadLiveAds, adToRing } from "@/lib/ads-data";
import { injectRingAds } from "@/lib/ads";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse: what Nigerian businesses are posting — BizNest",
  description: "See new products and daily updates from Nigerian shops, restaurants, hotels and service providers. Like, comment and tap through to their stores.",
  alternates: { canonical: "/browse" },
};

const chip = (active: boolean) => `shrink-0 rounded-full px-4 py-1.5 text-sm ${active ? "bg-white font-semibold text-black" : "border border-white/20 hover:bg-white/10"}`;

export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ sort?: string; category?: string }> }) {
  const sp = await searchParams;
  const sort: FeedSort = sp.sort === "popular" ? "popular" : "latest";
  const category = sp.category?.trim().slice(0, 80) || null;
  const viewer = await getViewer();
  const [feed, categories, organicRings, feedAds, storyAds] = await Promise.all([
    loadBrowseFeed({ sort, category, viewerKey: viewer?.key }), loadBrowseCategories(), loadStoryRings(viewer?.key),
    loadLiveAds("FEED", viewer?.key, 2), loadLiveAds("STORY", viewer?.key, 2),
  ]);
  const rings = injectRingAds(organicRings, storyAds).map((x) => x.ring ?? adToRing(x.ad!));
  const href = (next: { sort?: FeedSort; category?: string | null }) => {
    const q = new URLSearchParams();
    const s = next.sort ?? sort; const c = next.category === undefined ? category : next.category;
    if (s === "popular") q.set("sort", "popular");
    if (c) q.set("category", c);
    const qs = q.toString();
    return qs ? `/browse?${qs}` : "/browse";
  };

  return (
    <div className="bn-dark-surface min-h-screen">
      <div className="mx-auto max-w-xl px-4 pb-16 pt-6">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Browse</h1>
            <p className="text-sm opacity-70">Fresh from Nigerian businesses</p>
          </div>
          <nav aria-label="Browse sections" className="flex items-center gap-2 text-sm">
            <Link href="/search" className="rounded-full border border-white/25 px-3 py-1.5 hover:bg-white/10">Find businesses</Link>
            <Link href="/" className="opacity-70 hover:opacity-100">Home</Link>
          </nav>
        </header>

        <StoryRings rings={rings} />

        <div className="mb-3 flex gap-2" role="tablist" aria-label="Sort">
          <Link role="tab" aria-selected={sort === "latest"} href={href({ sort: "latest" })} className={chip(sort === "latest")}>Latest</Link>
          <Link role="tab" aria-selected={sort === "popular"} href={href({ sort: "popular" })} className={chip(sort === "popular")}>Popular</Link>
        </div>
        {categories.length > 0 && (
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Categories">
            <Link href={href({ category: null })} className={chip(!category)}>All</Link>
            {categories.map((c) => <Link key={c} href={href({ category: c })} className={chip(category === c)}>{c}</Link>)}
          </div>
        )}

        {feed.posts.length === 0 ? (
          <div className="bn-card flex flex-col items-center gap-2 p-12 text-center">
            <p className="font-medium">{category ? `Nothing posted in ${category} yet` : "No posts yet"}</p>
            <p className="text-sm opacity-70">Businesses on BizNest can share updates and products here.</p>
            {category ? <Link href="/browse" className="mt-2 text-sm font-medium text-primary hover:underline">See everything</Link> : <Link href="/search" className="mt-2 text-sm font-medium text-primary hover:underline">Find businesses</Link>}
          </div>
        ) : (
          <BrowseFeed key={`${sort}|${category ?? ""}`} initialPosts={feed.posts} initialCursor={feed.nextCursor} initialAds={feedAds} sort={sort} category={category} />
        )}
      </div>
    </div>
  );
}
