import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Store } from "lucide-react";
import { getViewer } from "@/lib/browse-viewer";
import { loadStorePosts, loadStoreProfile, loadStoreStories } from "@/lib/browse-data";
import { compactCount } from "@/lib/browse";
import { storeHref } from "@/lib/utils/store-href";
import { StoryRings } from "@/components/browse/story-rings";
import { StorePostsGrid } from "@/components/browse/store-posts-grid";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) return { title: "Not found" };
  const p = await loadStoreProfile(slug);
  if (!p) return { title: "Not found", robots: { index: false } };
  return {
    title: `${p.name} on BizNest: posts and updates`,
    description: `See what ${p.name}${p.city ? ` in ${p.city}` : ""} has been posting on BizNest.`,
    alternates: { canonical: `/browse/s/${p.slug}` },
  };
}

export default async function StoreBrowsePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) notFound();
  const profile = await loadStoreProfile(slug);
  if (!profile) notFound();
  const viewer = await getViewer();
  const [story, grid] = await Promise.all([loadStoreStories(profile.id, viewer?.key), loadStorePosts(profile.id)]);

  return (
    <div className="bn-dark-surface min-h-screen">
      <div className="mx-auto max-w-xl px-4 pb-16 pt-6">
        <Link href="/browse" className="mb-4 inline-block text-sm opacity-70 hover:opacity-100">← Back to Browse</Link>
        <header className="flex items-center gap-5">
          {story ? <StoryRings rings={[story]} size="lg" /> : (
            <span className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-3xl font-bold">
              {profile.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={profile.logoUrl} alt="" className="h-full w-full object-cover" /> : profile.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 text-xl font-bold"><span className="truncate">{profile.name}</span>{profile.verified && <BadgeCheck className="h-5 w-5 shrink-0 text-sky-400" aria-label="Verified business" />}</h1>
            <p className="text-sm opacity-70">{[profile.category, profile.city].filter(Boolean).join(" · ")}</p>
            <p className="mt-1 text-sm"><b>{compactCount(profile.postCount)}</b> posts · <b>{compactCount(profile.likeCount)}</b> likes</p>
          </div>
        </header>
        <Link href={storeHref(profile.slug)} className="mt-5 flex items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-semibold text-black"><Store className="h-4 w-4" /> Visit store</Link>

        <div className="mt-6 border-t border-white/10 pt-4">
          {grid.posts.length === 0 ? <p className="py-12 text-center text-sm opacity-70">No posts yet.</p> : <StorePostsGrid slug={profile.slug} initial={grid.posts} initialCursor={grid.nextCursor} />}
        </div>
      </div>
    </div>
  );
}
