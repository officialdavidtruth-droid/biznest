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
      <ul className="grid grid-cols-3 gap-2 sm:gap-3">
        {posts.map((p) => (
          <li key={p.id} className="group relative aspect-square overflow-hidden rounded-2xl bg-[#FBF6E9]">
            <Link href={postPath(p.id)} className="block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B82E]" aria-label={p.caption.slice(0, 80) || "Open post"}>
              {p.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : (
                <span className="grid h-full w-full place-items-center p-3 text-center text-xs font-medium leading-snug text-[#14301A]">{p.caption.slice(0, 90)}</span>
              )}
              <span className={`absolute right-2 top-2 flex gap-1 drop-shadow ${p.image ? "text-white" : "text-[#14301A]"}`}>
                {p.multi && <Copy className="h-4 w-4" aria-label="Several photos" />}
                {p.product && <ShoppingBag className="h-4 w-4" aria-label="Product" />}
              </span>
              <span className="absolute inset-0 flex items-center justify-center gap-4 bg-[#0A2012]/65 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                <span className="inline-flex items-center gap-1"><Heart className="h-4 w-4 fill-white" />{compactCount(p.likeCount)}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle className="h-4 w-4 fill-white" />{compactCount(p.commentCount)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {cursor && (
        <div className="py-5 text-center">
          <button disabled={pending} className="rounded-full bg-white/10 px-6 py-2.5 text-sm font-medium hover:bg-white/15 disabled:opacity-60"
            onClick={() => start(async () => { const r = await loadMoreStorePosts(slug, cursor); if (r.success) { setPosts((c) => [...c, ...r.data.posts.filter((n) => !c.some((o) => o.id === n.id))]); setCursor(r.data.nextCursor); } })}>
            {pending ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
