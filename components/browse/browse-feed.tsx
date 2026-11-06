"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadMoreBrowse } from "@/lib/actions/browse";
import { loadMoreFeedAds } from "@/lib/actions/ads";
import type { AdPublic } from "@/lib/ads-data";
import { AD_FEED_EVERY, injectAds } from "@/lib/ads";
import { AdCard } from "@/components/browse/ad-card";
import type { BrowsePostView, FeedSort } from "@/lib/browse-data";
import { PostCard } from "@/components/browse/post-card";

export function BrowseFeed({ initialPosts, initialCursor, initialAds = [], sort, category, following = false }: { initialPosts: BrowsePostView[]; initialCursor: string | null; initialAds?: AdPublic[]; sort: FeedSort; category: string | null; following?: boolean }) {
  const [posts, setPosts] = useState(initialPosts);
  const [ads, setAds] = useState<AdPublic[]>(initialAds);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const more = useCallback(async () => {
    if (busy.current || !cursor) return;
    busy.current = true; setLoading(true); setFailed(false);
    try {
      const [r, moreAds] = await Promise.all([loadMoreBrowse({ sort, category, cursor, following }), following ? Promise.resolve(null) : loadMoreFeedAds(Math.ceil(8 / AD_FEED_EVERY)).catch(() => null)]);
      if (!r.success) throw new Error(r.error);
      if (moreAds?.success) setAds((cur) => { const have = new Set(cur.map((a) => a.id)); return [...cur, ...moreAds.data.filter((a) => !have.has(a.id))]; });
      setPosts((cur) => {
        const seen = new Set(cur.map((p) => p.id));
        return [...cur, ...r.data.posts.filter((p) => !seen.has(p.id))];
      });
      setCursor(r.data.nextCursor);
    } catch { setFailed(true); } finally { busy.current = false; setLoading(false); }
  }, [cursor, sort, category, following]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || failed) return;
    const io = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) void more(); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, cursor, failed]);

  return (
    <div className="space-y-6">
      {injectAds(posts, ads).map((item) => item.type === "post" ? <PostCard key={item.post.id} post={item.post} /> : <AdCard key={`ad-${item.ad.id}`} ad={item.ad} />)}
      <div ref={sentinel} aria-hidden className="h-1" />
      {loading && <p className="py-4 text-center text-sm text-[#FBF6E9]/70" role="status">Loading more posts…</p>}
      {failed && <div className="py-4 text-center"><button className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium hover:bg-white/15" onClick={() => void more()}>Couldn&apos;t load. Tap to retry</button></div>}
      {!cursor && posts.length > 0 && <p className="py-8 text-center text-sm text-[#FBF6E9]/60">You&apos;ve seen everything for now. Check back later for new posts.</p>}
    </div>
  );
}
