import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/browse-viewer";
import { loadSavedPosts } from "@/lib/browse-data";
import { BrowseFeed } from "@/components/browse/browse-feed";
import { BrowseShell } from "@/components/browse/browse-shell";
import { BrowseTabs } from "@/components/browse/browse-tabs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saved — BizNest Browse", robots: { index: false } };

const display = "font-[family-name:var(--font-browse-display)]";

export default async function SavedPage() {
  const viewer = await getViewer();
  if (!viewer?.userId) redirect("/join?callbackUrl=%2Fbrowse%2Fsaved");
  const feed = await loadSavedPosts(viewer.key);
  return (
    <BrowseShell back={{ href: "/browse", label: "Browse" }}>
      <main className="mx-auto max-w-[600px] px-4 pb-20 pt-6">
        <BrowseTabs active="saved" />
        <h1 className={`${display} mb-5 text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl`}>Saved</h1>
        {feed.posts.length === 0 ? (
          <section className="rounded-[28px] bg-[#FBF6E9] px-6 py-8 text-center text-[#14301A]">
            <h2 className={`${display} text-2xl font-extrabold tracking-tight`}>Nothing saved yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-[#14301A]/75">Tap the bookmark on a post to keep it here, so you can find that product again.</p>
            <Link href="/browse" className="mt-5 inline-flex rounded-full bg-[#14301A] px-5 py-2.5 text-sm font-semibold text-[#FBF6E9]">Browse posts</Link>
          </section>
        ) : (
          <BrowseFeed initialPosts={feed.posts} initialCursor={feed.nextCursor} sort="latest" category={null} saved />
        )}
      </main>
    </BrowseShell>
  );
}
