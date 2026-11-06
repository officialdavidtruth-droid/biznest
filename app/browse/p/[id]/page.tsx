import { ogImageUrl, previewPrice } from "@/lib/browse";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/browse-viewer";
import { loadBrowsePost } from "@/lib/browse-data";
import { PostCard } from "@/components/browse/post-card";
import { BrowseShell } from "@/components/browse/browse-shell";

export const dynamic = "force-dynamic";

const ID_RE = /^[A-Za-z0-9_-]{10,40}$/;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!ID_RE.test(id)) return { title: "Post not found" };
  const post = await loadBrowsePost(id);
  if (!post) return { title: "Post not found", robots: { index: false } };
  const price = post.product ? previewPrice(post.product.price, post.product.currency) : null;
  const lead = post.product ? `${post.product.name}${price ? ` · ${price}` : ""}` : "";
  const description = [lead, post.caption].filter(Boolean).join(" — ").slice(0, 200) || `A post from ${post.store.name} on BizNest`;
  const title = post.product ? `${post.product.name}${price ? ` · ${price}` : ""} from ${post.store.name}` : `${post.store.name} on BizNest`;
  // With a photo, the preview is the photo. Without one, the generated card in opengraph-image.tsx is used.
  const image = post.images[0] ? [{ url: ogImageUrl(post.images[0]), width: 1200, height: 630, alt: title }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/browse/p/${post.id}` },
    openGraph: { type: "article", siteName: "BizNest", title, description, ...(image ? { images: image } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(image ? { images: image.map((i) => i.url) } : {}) },
  };
}

export default async function BrowsePostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_RE.test(id)) notFound();
  const viewer = await getViewer();
  const post = await loadBrowsePost(id, viewer?.key);
  if (!post) notFound();
  return (
    <BrowseShell back={{ href: "/browse", label: "Browse" }}>
      <main className="mx-auto max-w-xl px-4 pb-20 pt-6">
        <PostCard post={post} openComments />
      </main>
    </BrowseShell>
  );
}
