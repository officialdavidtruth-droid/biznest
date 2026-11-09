import type { Metadata } from "next";
import { getViewer } from "@/lib/browse-viewer";
import { loadBrowseFeed } from "@/lib/browse-data";
import { ReelsFeed } from "@/components/browse/reels-feed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reels — BizNest Browse", description: "Short videos from shops across Nigeria.", alternates: { canonical: "/browse/reels" } };

export default async function ReelsPage() {
  const viewer = await getViewer();
  const feed = await loadBrowseFeed({ sort: "popular", videoOnly: true, viewerKey: viewer?.key, limit: 8 });
  return <ReelsFeed initialPosts={feed.posts} initialCursor={feed.nextCursor} signedIn={!!viewer?.userId} />;
}
