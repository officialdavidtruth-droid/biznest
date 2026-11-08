import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Crown, MapPin, Tag } from "lucide-react";
import { getViewer } from "@/lib/browse-viewer";
import { loadStorePosts, loadStoreProfile, loadStoreStories } from "@/lib/browse-data";
import { isOfficialSlug, storeBrowsePath } from "@/lib/browse";
import { storeHref } from "@/lib/utils/store-href";
import { StoryRings } from "@/components/browse/story-rings";
import { StorePostsGrid } from "@/components/browse/store-posts-grid";
import { BrowseShell } from "@/components/browse/browse-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/lib/seo";
import { Awning } from "@/components/browse/awning";
import { ProfileActions } from "@/components/browse/profile-actions";
import { ProfileViewBeacon } from "@/components/browse/profile-view-beacon";
import { StoreBadges } from "@/components/browse/store-badges";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const display = "font-[family-name:var(--font-browse-display)]";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) return { title: "Not found" };
  const p = await loadStoreProfile(slug);
  if (!p) return { title: "Not found", robots: { index: false } };
  return {
    title: `${p.name}${p.city ? ` in ${p.city}` : ""} | posts and updates on BizNest`,
    keywords: [p.name, p.category, p.city && `${p.category ?? "shop"} in ${p.city}`, "Nigeria", "BizNest"].filter((k): k is string => !!k),
    description: (p.bio ? p.bio.slice(0, 160) : `See what ${p.name}${p.city ? ` in ${p.city}` : ""} has been posting on BizNest.`),
    alternates: { canonical: `/browse/s/${p.slug}` },
    // The preview image comes from opengraph-image.tsx next to this file.
    openGraph: { type: "profile", siteName: "BizNest", title: `${p.name} on BizNest`, description: p.bio ? p.bio.slice(0, 200) : `Posts and updates from ${p.name} on BizNest.` },
    twitter: { card: "summary_large_image", title: `${p.name} on BizNest` },
  };
}

export default async function StoreBrowsePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) notFound();
  const viewer = await getViewer();
  const profile = await loadStoreProfile(slug, viewer?.key);
  if (!profile) notFound();
  const [story, grid] = await Promise.all([loadStoreStories(profile.id, viewer?.key), loadStorePosts(profile.id)]);

  return (
    <BrowseShell back={{ href: "/browse", label: "Browse" }}>
      <main className="mx-auto max-w-2xl px-3 pb-20 pt-3">
        <JsonLd data={{
          "@context": "https://schema.org", "@type": "ProfilePage", url: `${SITE_URL}/browse/s/${profile.slug}`, name: `${profile.name} on BizNest`,
          mainEntity: {
            "@type": "Organization", name: profile.name, url: `${SITE_URL}/${profile.slug}`, ...(profile.logoUrl ? { logo: profile.logoUrl } : {}),
            ...(profile.bio ? { description: profile.bio.slice(0, 300) } : {}), ...(profile.category ? { knowsAbout: profile.category } : {}),
            ...(profile.city ? { address: { "@type": "PostalAddress", addressLocality: profile.city, addressCountry: "NG" } } : {}),
          },
        }} />
        <section className="overflow-hidden rounded-3xl bg-[#FBF6E9] text-[#14301A] shadow-[0_18px_40px_-20px_rgba(0,0,0,.65)]">
          <Awning height={22} />
          <div className="px-4 pb-4 pt-3">
            <div className="flex items-center gap-3">
              {story ? (
                <div className="shrink-0"><StoryRings rings={[story]} size="md" /></div>
              ) : (
                <span className="grid h-[68px] w-[68px] shrink-0 place-items-center overflow-hidden rounded-full bg-[#14301A]/10 text-2xl font-bold ring-[3px] ring-[#F5B82E] ring-offset-2 ring-offset-[#FBF6E9]">
                  {profile.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={profile.logoUrl} alt="" className="h-full w-full object-cover" /> : profile.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <h1 className={`${display} flex items-center gap-1.5 text-xl font-extrabold leading-tight tracking-tight`}>
                  <span className="min-w-0 break-words">{profile.name}</span>
                  <StoreBadges verified={profile.verified} mogul={profile.mogul} official={isOfficialSlug(profile.slug)} />
                </h1>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-medium">
                  {profile.category && <span className="inline-flex items-center gap-1 rounded-full bg-[#14301A]/[0.08] px-2 py-0.5"><Tag className="h-3 w-3" aria-hidden />{profile.category}</span>}
                  {profile.city && <span className="inline-flex items-center gap-1 rounded-full bg-[#14301A]/[0.08] px-2 py-0.5"><MapPin className="h-3 w-3" aria-hidden />{profile.city}</span>}
                </div>
                {isOfficialSlug(profile.slug) && <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#14301A] px-2 py-0.5 text-[11px] font-semibold text-[#FFE08A] ring-1 ring-[#F5B82E]">The official BizNest account</p>}
                {profile.mogul && <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FFE08A] to-[#F5B82E] px-2 py-0.5 text-[11px] font-semibold text-[#4a3000]"><Crown className="h-3 w-3" aria-hidden /> Business Mogul</p>}
                
              </div>
            </div>

            {profile.bio && <p className="mt-3 line-clamp-3 whitespace-pre-line break-words text-sm leading-snug text-[#14301A]/85">{profile.bio}</p>}

            <ProfileViewBeacon slug={slug} />
            <ProfileActions
              signedIn={!!viewer?.userId}
              slug={profile.slug} name={profile.name} path={storeBrowsePath(profile.slug)} storeUrl={storeHref(profile.slug)}
              initialFollowing={profile.following} initialCount={profile.followerCount} postCount={profile.postCount} likeCount={profile.likeCount}
            />
          </div>
        </section>

        <section className="mt-4" aria-label="Posts">
          <h2 className={`${display} mb-2 text-base font-extrabold tracking-tight`}>Posts</h2>
          {grid.posts.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/20 px-6 py-12 text-center">
              <p className={`${display} text-lg font-bold`}>{profile.name} hasn&apos;t posted yet</p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-[#FBF6E9]/70">Their products and updates will show up here. You can still shop in their store.</p>
              <Link href={storeHref(profile.slug)} className="mt-5 inline-flex rounded-full bg-[#F5B82E] px-6 py-2.5 text-sm font-semibold text-[#14301A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Visit store</Link>
            </div>
          ) : (
            <StorePostsGrid slug={profile.slug} initial={grid.posts} initialCursor={grid.nextCursor} />
          )}
        </section>
      </main>
    </BrowseShell>
  );
}
