import type { Metadata } from "next";
import { getViewer } from "@/lib/browse-viewer";
import { loadHashtagPosts } from "@/lib/browse-data";
import { PostCard } from "@/components/browse/post-card";
import { BrowseShell } from "@/components/browse/browse-shell";

export const dynamic = "force-dynamic";

const clean = (raw: string) => decodeURIComponent(raw).toLowerCase().replace(/[^\p{L}\p{N}_]/gu, "").slice(0, 30);

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params;
  const t = clean(tag);
  return { title: `#${t} on BizNest Browse`, description: `Posts tagged #${t} from businesses on BizNest.`, robots: { index: false } };
}

export default async function HashtagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const t = clean(tag);
  const viewer = await getViewer();
  const posts = await loadHashtagPosts(t, viewer?.key);
  return (
    <BrowseShell back={{ href: "/browse", label: "Browse" }}>
      <main className="mx-auto max-w-xl space-y-5 px-4 pb-20 pt-6">
        <h1 className="text-xl font-bold">#{t}</h1>
        {posts.length === 0
          ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No posts use #{t} yet.</p>
          : posts.map((p) => <PostCard key={p.id} post={p} />)}
      </main>
    </BrowseShell>
  );
}
