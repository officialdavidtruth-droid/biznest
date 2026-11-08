import type { Metadata } from "next";
import { getViewer } from "@/lib/browse-viewer";
import { loadHashtagPosts } from "@/lib/browse-data";
import { PostCard } from "@/components/browse/post-card";
import { BrowseShell } from "@/components/browse/browse-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const clean = (raw: string) => decodeURIComponent(raw).toLowerCase().replace(/[^\p{L}\p{N}_]/gu, "").slice(0, 30);

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params;
  const t = clean(tag);
  const title = `#${t} — posts from Nigerian businesses | BizNest`;
  const description = `Browse posts, products and services tagged #${t} from businesses on BizNest. Follow stores, see new arrivals and shop directly.`;
  // Thin pages stay out of Google; a tag with real posts is indexable.
  const posts = t ? await loadHashtagPosts(t, undefined, 1) : [];
  return {
    title, description, keywords: [t, `${t} Nigeria`, `buy ${t}`, "BizNest"],
    alternates: { canonical: `/browse/tag/${encodeURIComponent(t)}` },
    robots: posts.length > 0 ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { type: "website", siteName: "BizNest", title, description },
    twitter: { card: "summary", title, description },
  };
}

export default async function HashtagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const t = clean(tag);
  const viewer = await getViewer();
  const posts = await loadHashtagPosts(t, viewer?.key);
  return (
    <BrowseShell back={{ href: "/browse", label: "Browse" }}>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "CollectionPage", name: `#${t} on BizNest`, url: `${SITE_URL}/browse/tag/${encodeURIComponent(t)}`,
        mainEntity: { "@type": "ItemList", itemListElement: posts.slice(0, 20).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/browse/p/${p.id}`, name: p.caption.slice(0, 80) || p.store.name })) },
      }} />
      <main className="mx-auto max-w-xl space-y-5 px-4 pb-20 pt-6">
        <h1 className="text-xl font-bold">#{t}</h1>
        {posts.length === 0
          ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No posts use #{t} yet.</p>
          : posts.map((p) => <PostCard key={p.id} post={p} />)}
      </main>
    </BrowseShell>
  );
}
