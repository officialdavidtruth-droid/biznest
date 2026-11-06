"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Heart, MessageCircle, ShoppingBag } from "lucide-react";
import { loadMoreStorePosts } from "@/lib/actions/browse";
import type { GridPost } from "@/lib/browse-data";
import { compactCount, postPath } from "@/lib/browse";

export function StorePostsGrid({ slug, initial, initialCursor }: { slug: string; initial: GridPost[]; initialCursor: string | null }) {
  const [posts, setPosts] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, start] = useTransition();
  return (
    <div>
      <ul className="grid grid-cols-3 gap-1">
        {posts.map((p) => (
          <li key={p.id} className="group relative aspect-square overflow-hidden bg-white/5">
            <Link href={postPath(p.id)} className="block h-full w-full" aria-label={p.caption.slice(0, 80) || "Open post"}>
              {p.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : (
                <span className="grid h-full w-full place-items-center p-2 text-center text-xs opacity-80">{p.caption.slice(0, 90)}</span>
              )}
              <span className="absolute right-1.5 top-1.5 flex gap-1 text-white drop-shadow">
                {p.multi && <Copy className="h-4 w-4" aria-label="Several photos" />}
                {p.product && <ShoppingBag className="h-4 w-4" aria-label="Product" />}
              </span>
              <span className="absolute inset-0 flex items-center justify-center gap-4 bg-black/50 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                <span className="inline-flex items-center gap-1"><Heart className="h-4 w-4 fill-white" />{compactCount(p.likeCount)}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle className="h-4 w-4 fill-white" />{compactCount(p.commentCount)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {cursor && (
        <div className="py-5 text-center">
          <button disabled={pending} className="rounded-full border border-white/25 px-5 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
            onClick={() => start(async () => { const r = await loadMoreStorePosts(slug, cursor); if (r.success) { setPosts((c) => [...c, ...r.data.posts.filter((n) => !c.some((o) => o.id === n.id))]); setCursor(r.data.nextCursor); } })}>
            {pending ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
