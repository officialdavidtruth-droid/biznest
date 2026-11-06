import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/browse-viewer";
import { loadBrowsePost } from "@/lib/browse-data";
import { PostCard } from "@/components/browse/post-card";

export const dynamic = "force-dynamic";

const ID_RE = /^[A-Za-z0-9_-]{10,40}$/;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!ID_RE.test(id)) return { title: "Post not found" };
  const post = await loadBrowsePost(id);
  if (!post) return { title: "Post not found", robots: { index: false } };
  const description = (post.caption || `A post from ${post.store.name} on BizNest`).slice(0, 160);
  return {
    title: `${post.store.name} on BizNest`,
    description,
    alternates: { canonical: `/browse/p/${post.id}` },
    openGraph: { title: `${post.store.name} on BizNest`, description, images: post.images[0] ? [{ url: post.images[0] }] : undefined },
    twitter: { card: post.images[0] ? "summary_large_image" : "summary", title: `${post.store.name} on BizNest`, description },
  };
}

export default async function BrowsePostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_RE.test(id)) notFound();
  const viewer = await getViewer();
  const post = await loadBrowsePost(id, viewer?.key);
  if (!post) notFound();
  return (
    <div className="bn-dark-surface min-h-screen">
      <div className="mx-auto max-w-xl px-4 pb-16 pt-6">
        <Link href="/browse" className="mb-4 inline-block text-sm opacity-70 hover:opacity-100">← Back to Browse</Link>
        <PostCard post={post} openComments />
      </div>
    </div>
  );
}
